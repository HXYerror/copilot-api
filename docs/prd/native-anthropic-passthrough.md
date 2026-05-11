# Native Anthropic Pass-Through for Claude Models

## Status
Approved

## Overview
Route Anthropic `/v1/messages` requests for Claude models directly to the GitHub Copilot upstream's native Anthropic endpoint, bypassing the existing OpenAI translation layer. This preserves thinking blocks with `signature` field, `top_k`, `cache_control`, and richer usage stats — none of which survive the current translation round-trip.

## Motivation
GitHub Copilot's upstream (`api.enterprise.githubcopilot.com`) natively speaks the Anthropic Messages API for all Claude 4.5+ models. The current code path translates Anthropic → OpenAI → sends → translates back, losing:
- `thinking` blocks (completely dropped)
- `signature` field on thinking blocks (required for multi-turn reasoning)
- `cache_creation_input_tokens` in usage
- `top_k` parameter
- `cache_control` on system/user blocks

The fix: detect Claude models by `vendor === "Anthropic"` from the `/models` endpoint, and forward requests verbatim to `/v1/messages` upstream.

## Requirements

1. **`create-messages-native.ts`** — Service client that POSTs Anthropic payloads directly to `${copilotBaseUrl}/v1/messages` with correct headers (`anthropic-version`, `anthropic-beta`).
2. **Route dispatch** — `handler.ts` checks `isNativeAnthropicModel(model)` and branches to native path for Claude, translation path for everything else.
3. **`native-models.ts`** — `isNativeAnthropicModel(modelId)` checks `state.models` vendor field; falls back to `claude-` prefix heuristic before models load.
4. **Type fixes** — `anthropic-types.ts`: `signature?` on `AnthropicThinkingBlock`; union `thinking` type for adaptive (opus-4.7+); `output_config`; `AnthropicImageBlock` URL source; `AnthropicToolResultBlock.content` widened.
5. **Adaptive thinking upgrade** — `create-messages-native.ts` auto-upgrades `{ type: "enabled" }` → `{ type: "adaptive" }` + `output_config.effort` for `claude-opus-4.7+` models.
6. **SSE proxy** — Streaming responses from native path forwarded verbatim to client (no re-translation needed).

## Acceptance Criteria

- Claude models (`vendor === "Anthropic"`) route to native path; non-Claude models route to translation path.
- Thinking blocks with `signature` field returned to client in both streaming and non-streaming.
- Multi-turn conversations with thinking blocks (echoing `signature`) work correctly.
- `claude-opus-4.7+` with `{ type: "enabled" }` thinking auto-upgrades to adaptive format; no HTTP 400.
- All existing tests pass; new tests cover native vs. translation dispatch.

## Technical Approach

### Model detection
`state.models.data` from `/models` endpoint has `vendor: "Anthropic"` for all Claude models. `isNativeAnthropicModel()` checks this first, falls back to `startsWith("claude-")` heuristic.

### Headers for native path
```
anthropic-version: 2023-06-01
anthropic-beta: interleaved-thinking-2025-05-14,prompt-caching-2024-07-31
```
Plus all standard Copilot headers (auth, editor-version, etc.).

### Streaming proxy
Native upstream sends proper Anthropic SSE events. Parse `event.type` for logging; forward `rawEvent.data` verbatim. No translation needed.

### Adaptive thinking (opus-4.7+)
If model matches `/^claude-opus-4[.-](\d+)/` with minor ≥ 7, auto-upgrade `{ type: "enabled", budget_tokens: N }` → `{ type: "adaptive" }` + `output_config: { effort: "medium" }`.

## File Changes

**New:**
- `src/services/copilot/create-messages-native.ts`
- `src/services/copilot/native-models.ts`

**Modified:**
- `src/routes/messages/anthropic-types.ts` — type fixes
- `src/routes/messages/handler.ts` — dispatch logic
- `src/routes/messages/non-stream-translation.ts` — remove stale comment; fix image source narrowing

## Testing Strategy
- Unit: `isNativeAnthropicModel()` with populated vs empty `state.models`
- Unit: `buildUpstreamPayload()` adaptive thinking upgrade
- Integration: handler routes Claude models to native, GPT models to translation
- Existing translation tests must still pass

## Out of Scope
- Persistent caching of native responses
- URL image sources (rejected by upstream; type kept for fidelity)
- Responses API (#1 epic)
