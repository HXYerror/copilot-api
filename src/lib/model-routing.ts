/**
 * Model-to-endpoint routing.
 *
 * Copilot upstream serves some models exclusively via the Responses API
 * (/responses) and others via Chat Completions (/chat/completions).
 * Sending a Responses-only model to /chat/completions produces an error.
 *
 * Detection order:
 *  1. If state.models is loaded, check model capabilities.type === "responses"
 *     (if the upstream ever adds this field). Currently Copilot doesn't set it,
 *     so we fall through to step 2.
 *  2. Static prefix/suffix list (known Responses-only models as of 2025-05).
 *
 * "Responses-only" models: all gpt-5*-codex variants, o1-pro, o3-pro.
 * Everything else (gpt-4o, gpt-5, o1, o3, o4-mini, claude-*, gemini-*) uses
 * Chat Completions (or native Anthropic pass-through for Claude).
 */

import { state } from "~/lib/state"

/** Endpoint mode for routing. */
export type ModelMode = "chat" | "responses"

/**
 * Returns the upstream endpoint mode for the given model ID.
 * "responses" = must use /responses; "chat" = use /chat/completions (or native Anthropic).
 */
export function getModelMode(modelId: string): ModelMode {
  // Guard: treat missing/empty model as "chat" — upstream will reject with a proper error
  if (!modelId) return "chat"

  // 1. Check state.models capabilities if available (future-proof)
  if (state.models?.data) {
    const entry = state.models.data.find((m) => m.id === modelId)
    if (entry?.capabilities.type === "responses") return "responses"
    if (entry?.capabilities.type === "chat") return "chat" // trust upstream when explicit
  }

  // 2. Static heuristic: Responses-only models have "codex" in the name
  //    or are o-series "pro" variants.
  return isResponsesOnlyModel(modelId) ? "responses" : "chat"
}

/**
 * Returns true if the model is known to be Responses-only on Copilot upstream.
 */
export function isResponsesOnlyModel(modelId: string): boolean {
  // codex family: gpt-5-codex, gpt-5.1-codex, gpt-5.1-codex-max, gpt-5.3-codex, etc.
  // Anchored to word boundaries to avoid matching hypothetical future "codex-mini" chat models.
  if (/(?:^|-)codex(?:-|$)/.test(modelId)) return true
  // o-pro family: o1-pro, o3-pro, o1-pro-2025-04-09, o3-pro-2025-01-10, etc.
  // Covers: o\d+-pro(?:-\d{4}-\d{2}-\d{2})? — requires string to end after "pro" or date
  if (/^o\d+-pro(?:-\d{4}-\d{2}-\d{2})?$/.test(modelId)) return true
  return false
}
