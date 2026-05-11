/**
 * Response translation for the Responses API path.
 *
 * Key invariants:
 *  - reasoning items MUST preserve `encrypted_content` verbatim (required for
 *    multi-turn continuity — see issue #6 and litellm PR #17130)
 *  - `status: null` fields are stripped (Copilot upstream rejects null status
 *    on subsequent turns — see litellm PR #22370)
 */

import type { ResponsesResponse, ResponsesOutputItem } from "./types"

// Upstream (e.g. litellm) may send `status: null` even though our TypeScript
// types forbid it.  Use a separate loose type to represent that reality.
type LooseOutputItem = Omit<ResponsesOutputItem, "status"> & {
  status?: string | null
}

/**
 * Sanitise a Responses API response object before forwarding to the client.
 *
 * Guarantees:
 *  1. `encrypted_content` on reasoning items is preserved (never stripped).
 *  2. `status: null` is removed from all output items.
 *  3. All other fields are passed through untouched.
 */
export function sanitiseResponsesOutput(
  response: ResponsesResponse,
): ResponsesResponse {
  return {
    ...response,
    output: response.output.map((item) => sanitiseOutputItem(item)),
  }
}

/**
 * Sanitise a single output item from an SSE event or non-streaming response.
 * Exported so the streaming path can apply the same logic per-event.
 */
export function sanitiseOutputItem(
  item: ResponsesOutputItem,
): ResponsesOutputItem {
  // Cast to the loose type so the null-status check is valid at compile time.
  const loose = item as unknown as LooseOutputItem
  if (loose.status === null) {
    const { status: _dropped, ...rest } = loose
    return rest as unknown as ResponsesOutputItem
  }
  return item
}
