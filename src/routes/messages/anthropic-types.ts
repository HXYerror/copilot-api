// Anthropic API Types

export interface AnthropicMessagesPayload {
  model: string
  messages: Array<AnthropicMessage>
  max_tokens: number
  system?: string | Array<AnthropicTextBlock>
  metadata?: {
    user_id?: string
  }
  stop_sequences?: Array<string>
  stream?: boolean
  temperature?: number
  top_p?: number
  top_k?: number
  tools?: Array<AnthropicTool>
  tool_choice?: {
    type: "auto" | "any" | "tool" | "none"
    name?: string
  }
  /**
   * Thinking config.
   * - Legacy (claude-3.7 / claude-4.5): `{ type: "enabled", budget_tokens: N }`
   * - New adaptive (claude-opus-4.7+): `{ type: "adaptive" }` paired with
   *   `output_config.effort` in the request body.
   */
  thinking?: { type: "enabled"; budget_tokens?: number } | { type: "adaptive" }
  /** Used together with `thinking: { type: "adaptive" }` on opus-4.7+. */
  output_config?: {
    effort?: "low" | "medium" | "high"
  }
  service_tier?: "auto" | "standard_only"
}

export interface AnthropicTextBlock {
  type: "text"
  text: string
}

export interface AnthropicImageBlock {
  type: "image"
  source:
    | {
        type: "base64"
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
        data: string
      }
    | {
        /** URL images are rejected by Copilot upstream — kept for type fidelity only. */
        type: "url"
        url: string
      }
}

export interface AnthropicToolResultBlock {
  type: "tool_result"
  tool_use_id: string
  /** May be a plain string or an array of content blocks. */
  content: string | Array<AnthropicTextBlock | AnthropicImageBlock>
  is_error?: boolean
}

export interface AnthropicToolUseBlock {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AnthropicThinkingBlock {
  type: "thinking"
  thinking: string
  /**
   * Opaque signature returned by the upstream for extended thinking blocks.
   * Must be echoed back in subsequent turns to enable multi-turn reasoning.
   * Present on native pass-through responses; absent on translated responses.
   */
  signature?: string
}

export type AnthropicUserContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolResultBlock

export type AnthropicAssistantContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicThinkingBlock

export interface AnthropicUserMessage {
  role: "user"
  content: string | Array<AnthropicUserContentBlock>
}

export interface AnthropicAssistantMessage {
  role: "assistant"
  content: string | Array<AnthropicAssistantContentBlock>
}

export type AnthropicMessage = AnthropicUserMessage | AnthropicAssistantMessage

export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export interface AnthropicResponse {
  id: string
  type: "message"
  role: "assistant"
  content: Array<AnthropicAssistantContentBlock>
  model: string
  stop_reason:
    | "end_turn"
    | "max_tokens"
    | "stop_sequence"
    | "tool_use"
    | "pause_turn"
    | "refusal"
    | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    /** Present on native pass-through responses. */
    service_tier?: "standard" | "priority" | "batch"
  }
}

export type AnthropicResponseContentBlock = AnthropicAssistantContentBlock

// Anthropic Stream Event Types
export interface AnthropicMessageStartEvent {
  type: "message_start"
  message: Omit<
    AnthropicResponse,
    "content" | "stop_reason" | "stop_sequence"
  > & {
    content: []
    stop_reason: null
    stop_sequence: null
  }
}

export interface AnthropicContentBlockStartEvent {
  type: "content_block_start"
  index: number
  content_block:
    | { type: "text"; text: string }
    | (Omit<AnthropicToolUseBlock, "input"> & {
        input: Record<string, unknown>
      })
    | { type: "thinking"; thinking: string }
}

export interface AnthropicContentBlockDeltaEvent {
  type: "content_block_delta"
  index: number
  delta:
    | { type: "text_delta"; text: string }
    | { type: "input_json_delta"; partial_json: string }
    | { type: "thinking_delta"; thinking: string }
    | { type: "signature_delta"; signature: string }
}

export interface AnthropicContentBlockStopEvent {
  type: "content_block_stop"
  index: number
}

export interface AnthropicMessageDeltaEvent {
  type: "message_delta"
  delta: {
    stop_reason?: AnthropicResponse["stop_reason"]
    stop_sequence?: string | null
  }
  usage?: {
    input_tokens?: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export interface AnthropicMessageStopEvent {
  type: "message_stop"
}

export interface AnthropicPingEvent {
  type: "ping"
}

export interface AnthropicErrorEvent {
  type: "error"
  error: {
    type: string
    message: string
  }
}

export type AnthropicStreamEventData =
  | AnthropicMessageStartEvent
  | AnthropicContentBlockStartEvent
  | AnthropicContentBlockDeltaEvent
  | AnthropicContentBlockStopEvent
  | AnthropicMessageDeltaEvent
  | AnthropicMessageStopEvent
  | AnthropicPingEvent
  | AnthropicErrorEvent

// State for streaming translation
export interface AnthropicStreamState {
  messageStartSent: boolean
  contentBlockIndex: number
  contentBlockOpen: boolean
  toolCalls: {
    [openAIToolIndex: number]: {
      id: string
      name: string
      anthropicBlockIndex: number
    }
  }
}
