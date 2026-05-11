import type { ServerSentEventMessage } from "fetch-event-stream"

import consola from "consola"
import { events } from "fetch-event-stream"

import type {
  ResponsesContentPart,
  ResponsesInputItem,
  ResponsesPayload,
  ResponsesResponse,
} from "~/routes/responses/types"

import { copilotHeaders, copilotBaseUrl } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if any input item contains an `input_image` content part.
 * Handles both a top-level string input and an array of input items.
 */
export function inputHasImages(payload: ResponsesPayload): boolean {
  if (typeof payload.input === "string") return false

  return payload.input.some((item) => {
    if (item.type !== "message") return false
    if (typeof item.content === "string") return false
    return item.content.some(
      (part: ResponsesContentPart) => part.type === "input_image",
    )
  })
}

/**
 * Returns true if this looks like an agent/multi-turn call:
 * - any input item has role "assistant", OR
 * - any item has type "function_call_output" or "function_call"
 */
export function isAgentCall(payload: ResponsesPayload): boolean {
  if (typeof payload.input === "string") return false

  return payload.input.some(
    (item: ResponsesInputItem) =>
      ("role" in item && item.role === "assistant")
      || item.type === "function_call_output"
      || item.type === "function_call",
  )
}

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

export const createResponses = async (
  payload: ResponsesPayload,
): Promise<
  ResponsesResponse | AsyncGenerator<ServerSentEventMessage, void, unknown>
> => {
  if (!state.copilotToken) throw new Error("Copilot token not found")

  const enableVision = inputHasImages(payload)

  const initiator = isAgentCall(payload) ? "agent" : "user"

  // TODO(#11): add Copilot-Vision-Request header when vision detected
  const headers: Record<string, string> = {
    ...copilotHeaders(state, enableVision),
    "X-Initiator": initiator,
  }

  const response = await fetch(`${copilotBaseUrl(state)}/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    consola.error("Failed to create responses", response)
    throw new HTTPError("Failed to create responses", response)
  }

  if (payload.stream) {
    return events(response)
  }

  return (await response.json()) as ResponsesResponse
}
