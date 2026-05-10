import type { Context } from "hono"

import consola from "consola"
import { streamSSE } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import {
  createChatCompletions,
  type ChatCompletionChunk,
  type ChatCompletionResponse,
} from "~/services/copilot/create-chat-completions"
import { createMessagesNative } from "~/services/copilot/create-messages-native"
import { isNativeAnthropicModel } from "~/services/copilot/native-models"

import {
  type AnthropicMessagesPayload,
  type AnthropicStreamEventData,
  type AnthropicStreamState,
} from "./anthropic-types"
import {
  translateToAnthropic,
  translateToOpenAI,
} from "./non-stream-translation"
import { translateChunkToAnthropicEvents } from "./stream-translation"

export async function handleCompletion(c: Context) {
  await checkRateLimit(state)

  const anthropicPayload = await c.req.json<AnthropicMessagesPayload>()
  consola.debug("Anthropic request payload:", JSON.stringify(anthropicPayload))

  if (state.manualApprove) {
    await awaitApproval()
  }

  // Route to native Anthropic pass-through for Claude models to preserve
  // thinking blocks (with signature), top_k, cache_control, and richer usage.
  if (isNativeAnthropicModel(anthropicPayload.model)) {
    return handleNative(c, anthropicPayload)
  }

  return handleTranslated(c, anthropicPayload)
}

// ---------------------------------------------------------------------------
// Native Anthropic pass-through (Claude 4.5+ models)
// ---------------------------------------------------------------------------

async function handleNative(
  c: Context,
  payload: AnthropicMessagesPayload,
): Promise<Response> {
  consola.debug("Using native Anthropic pass-through for", payload.model)

  const response = await createMessagesNative(payload)

  if (!payload.stream) {
    // Non-streaming: upstream already returned a complete Anthropic response
    consola.debug(
      "Native non-streaming response:",
      JSON.stringify(response).slice(0, 400),
    )
    return c.json(response)
  }

  // Streaming: proxy the SSE events directly to the client
  consola.debug("Native streaming response — proxying SSE events")
  return streamSSE(c, async (stream) => {
    for await (const rawEvent of response as AsyncIterable<{
      data?: string
      event?: string
    }>) {
      if (rawEvent.data === "[DONE]") break
      if (!rawEvent.data) continue

      // Parse to log but forward the original JSON verbatim
      try {
        const parsed = JSON.parse(rawEvent.data) as AnthropicStreamEventData
        consola.debug("Native SSE event:", parsed.type)
        await stream.writeSSE({
          event: parsed.type,
          data: rawEvent.data,
        })
      } catch {
        // Malformed chunk — skip
        consola.warn("Could not parse native SSE chunk:", rawEvent.data)
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Translation path (non-Claude models via /chat/completions)
// ---------------------------------------------------------------------------

async function handleTranslated(
  c: Context,
  anthropicPayload: AnthropicMessagesPayload,
): Promise<Response> {
  const openAIPayload = translateToOpenAI(anthropicPayload)
  consola.debug(
    "Translated OpenAI request payload:",
    JSON.stringify(openAIPayload),
  )

  const response = await createChatCompletions(openAIPayload)

  if (isNonStreaming(response)) {
    consola.debug(
      "Non-streaming response from Copilot:",
      JSON.stringify(response).slice(-400),
    )
    const anthropicResponse = translateToAnthropic(response)
    consola.debug(
      "Translated Anthropic response:",
      JSON.stringify(anthropicResponse),
    )
    return c.json(anthropicResponse)
  }

  consola.debug("Streaming response from Copilot")
  return streamSSE(c, async (stream) => {
    const streamState: AnthropicStreamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {},
    }

    for await (const rawEvent of response) {
      consola.debug("Copilot raw stream event:", JSON.stringify(rawEvent))
      if (rawEvent.data === "[DONE]") {
        break
      }

      if (!rawEvent.data) {
        continue
      }

      const chunk = JSON.parse(rawEvent.data) as ChatCompletionChunk
      const events = translateChunkToAnthropicEvents(chunk, streamState)

      for (const event of events) {
        consola.debug("Translated Anthropic event:", JSON.stringify(event))
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }
    }
  })
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof createChatCompletions>>,
): response is ChatCompletionResponse => Object.hasOwn(response, "choices")
