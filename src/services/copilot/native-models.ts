/**
 * Dynamic detection of which models support native Anthropic pass-through.
 *
 * The Copilot `/models` endpoint returns a `vendor` field for each model.
 * Any model with `vendor === "Anthropic"` is served natively via the
 * `/v1/messages` path at `api.enterprise.githubcopilot.com`.
 *
 * We cache the set of native model IDs after the first `/models` call and
 * keep it in sync with `state.models` (which is refreshed periodically by
 * the token-rotation logic).
 */

import { state } from "~/lib/state"

/**
 * Returns true if the given model ID should be routed to the native
 * Anthropic pass-through service instead of the OpenAI chat-completions
 * translation layer.
 *
 * Resolution order:
 *  1. If `state.models` is populated, check whether the model's vendor is
 *     "Anthropic" (live, always up-to-date).
 *  2. Fall back to a static prefix list for resilience at startup before
 *     the models list is fetched.
 */
export function isNativeAnthropicModel(modelId: string): boolean {
  if (state.models?.data) {
    const entry = state.models.data.find((m) => m.id === modelId)
    if (entry) {
      return entry.vendor === "Anthropic"
    }
    // Model not found in list — fall through to prefix heuristic
  }

  return modelId.startsWith("claude-")
}
