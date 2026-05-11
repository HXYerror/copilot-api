import type { Context } from "hono"

import consola from "consola"
import { streamSSE } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { state } from "~/lib/state"
import { createResponses } from "~/services/copilot/create-responses"

import type { ResponsesPayload } from "./types"

export async function handleResponses(c: Context): Promise<Response> {
  let payload: ResponsesPayload
  try {
    payload = await c.req.json<ResponsesPayload>()
  } catch {
    return c.json(
      {
        error: {
          message: "Invalid JSON body",
          type: "invalid_request_error",
          code: "invalid_json",
        },
      },
      400,
    )
  }

  consola.debug("Responses API request payload:", JSON.stringify(payload))

  if (state.manualApprove) {
    await awaitApproval()
  }

  const response = await createResponses(payload)

  if (!payload.stream) {
    consola.debug(
      "Responses non-streaming response:",
      JSON.stringify(response).slice(0, 400),
    )
    return c.json(response)
  }

  // Streaming: proxy SSE events verbatim (same pattern as native Anthropic pass-through)
  consola.debug("Responses streaming response — proxying SSE events")
  return streamSSE(
    c,
    async (stream) => {
      for await (const rawEvent of response as AsyncIterable<{
        data?: string
        event?: string
      }>) {
        if (!rawEvent.data) continue

        // Forward verbatim first
        await stream.writeSSE({
          event: rawEvent.event,
          data: rawEvent.data,
        })

        // Parse only for debug logging
        try {
          const parsed = JSON.parse(rawEvent.data) as { type: string }
          consola.debug("Responses SSE event:", parsed.type)
        } catch {
          consola.warn(
            "Could not parse Responses SSE chunk for logging:",
            rawEvent.data.slice(0, 200),
          )
        }
      }
    },
    async (err, stream) => {
      consola.error("Responses SSE stream error:", err)
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: String(err) }),
      })
    },
  )
}
