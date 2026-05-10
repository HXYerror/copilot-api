import { describe, test, expect, afterEach } from "bun:test"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { state } from "~/lib/state"
import { buildUpstreamPayload } from "~/services/copilot/create-messages-native"
import { isNativeAnthropicModel } from "~/services/copilot/native-models"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid payload base — only the fields required by the type. */
function basePayload(
  overrides: Partial<AnthropicMessagesPayload>,
): AnthropicMessagesPayload {
  return {
    model: "claude-sonnet-4-5",
    messages: [{ role: "user", content: "hi" }],
    max_tokens: 1024,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildUpstreamPayload tests
// ---------------------------------------------------------------------------

describe("buildUpstreamPayload", () => {
  // T1 — output_config present but thinking absent → output_config stripped
  test("T1: strips output_config when thinking is absent", () => {
    const payload = basePayload({
      output_config: { effort: "high" },
    })
    const result = buildUpstreamPayload(payload)
    expect(result).not.toHaveProperty("output_config")
    expect(result).not.toHaveProperty("thinking")
  })

  // T2 — adaptive upgrade preserves explicit output_config: { effort: "high" }
  test("T2: adaptive upgrade preserves explicit output_config effort", () => {
    const payload = basePayload({
      model: "claude-opus-4.7",
      thinking: { type: "enabled" },
      output_config: { effort: "high" },
    } as Partial<AnthropicMessagesPayload>)
    const result = buildUpstreamPayload(payload)
    expect(result.thinking).toEqual({ type: "adaptive" })
    // Should keep caller's "high", not override to "medium"
    expect(result.output_config).toEqual({ effort: "high" })
  })

  // T3 — already adaptive → forwarded as-is
  test("T3: already-adaptive thinking forwarded as-is", () => {
    const payload = basePayload({
      model: "claude-opus-4.7",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
    } as Partial<AnthropicMessagesPayload>)
    const result = buildUpstreamPayload(payload)
    expect(result.thinking).toEqual({ type: "adaptive" })
    expect(result.output_config).toEqual({ effort: "low" })
  })

  // T4 — legacy model with enabled thinking → kept as-is, no adaptive upgrade
  test("T4: legacy model with enabled thinking kept as-is", () => {
    const payload = basePayload({
      model: "claude-sonnet-4-5",
      thinking: { type: "enabled", budget_tokens: 1024 },
    } as Partial<AnthropicMessagesPayload>)
    const result = buildUpstreamPayload(payload)
    expect(result.thinking).toEqual({ type: "enabled", budget_tokens: 1024 })
    expect(result).not.toHaveProperty("output_config")
  })
})

// ---------------------------------------------------------------------------
// isNativeAnthropicModel tests
// ---------------------------------------------------------------------------

// Save original models state and restore after each test
const originalModels = state.models

afterEach(() => {
  state.models = originalModels
})

describe("isNativeAnthropicModel", () => {
  // T5 — model in loaded list with vendor "Anthropic" → true
  test("T5: model with vendor Anthropic in loaded list → true", () => {
    state.models = {
      object: "list",
      data: [
        {
          id: "claude-sonnet-4-5",
          vendor: "Anthropic",
          name: "Claude Sonnet 4.5",
          object: "model",
          version: "1",
          preview: false,
          model_picker_enabled: true,
          capabilities: {
            family: "claude",
            limits: {},
            object: "model_capabilities",
            supports: {},
            tokenizer: "cl100k_base",
            type: "chat",
          },
        },
      ],
    }
    expect(isNativeAnthropicModel("claude-sonnet-4-5")).toBe(true)
  })

  // T6 — model in loaded list with vendor "OpenAI" → false
  test("T6: model with vendor OpenAI in loaded list → false", () => {
    state.models = {
      object: "list",
      data: [
        {
          id: "gpt-4o",
          vendor: "OpenAI",
          name: "GPT-4o",
          object: "model",
          version: "1",
          preview: false,
          model_picker_enabled: true,
          capabilities: {
            family: "gpt",
            limits: {},
            object: "model_capabilities",
            supports: {},
            tokenizer: "cl100k_base",
            type: "chat",
          },
        },
      ],
    }
    expect(isNativeAnthropicModel("gpt-4o")).toBe(false)
  })

  // T7 — model NOT in loaded list, starts with "claude-" → true (heuristic)
  test("T7: model not in loaded list but starts with claude- → true", () => {
    state.models = { object: "list", data: [] }
    expect(isNativeAnthropicModel("claude-future-1")).toBe(true)
  })

  // T8 — model NOT in loaded list, starts with "gpt-" → false
  test("T8: model not in loaded list and starts with gpt- → false", () => {
    state.models = { object: "list", data: [] }
    expect(isNativeAnthropicModel("gpt-5")).toBe(false)
  })

  // T9 — state.models undefined → heuristic
  test("T9: state.models undefined → heuristic (claude- prefix → true)", () => {
    state.models = undefined
    expect(isNativeAnthropicModel("claude-something")).toBe(true)
  })
})
