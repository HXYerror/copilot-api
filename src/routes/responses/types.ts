// Request types
export interface ResponsesPayload {
  model: string
  input: Array<ResponsesInputItem>
  instructions?: string
  tools?: Array<ResponsesTool>
  tool_choice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; name: string }
  temperature?: number | null
  top_p?: number | null
  max_output_tokens?: number | null
  reasoning?: {
    effort?: "low" | "medium" | "high"
    summary?: "auto" | "concise" | "detailed"
  } | null
  previous_response_id?: string | null
  store?: boolean | null
  include?: Array<string> | null
  stream?: boolean | null
  metadata?: Record<string, string> | null
  parallel_tool_calls?: boolean | null
  service_tier?: "auto" | "default" | null
  truncation?: "auto" | "disabled" | null
  user?: string | null
}

// Input item types (union)
export type ResponsesInputItem =
  | ResponsesInputMessage
  | ResponsesInputFunctionCall
  | ResponsesFunctionCallOutput
  | ResponsesReasoningItem

export interface ResponsesInputMessage {
  type: "message"
  role: "user" | "assistant" | "system" | "developer"
  content: string | Array<ResponsesContentPart>
  id?: string
  status?: "completed" | "incomplete" | null
}

export interface ResponsesInputFunctionCall {
  type: "function_call"
  id?: string
  call_id: string
  name: string
  arguments: string
  status?: "completed" | "in_progress" | "incomplete" | null
}

export interface ResponsesFunctionCallOutput {
  type: "function_call_output"
  call_id: string
  output: string
}

export interface ResponsesReasoningItem {
  type: "reasoning"
  id: string
  encrypted_content?: string
  summary?: Array<{ type: "summary_text"; text: string }>
  status?: "completed" | "in_progress" | "incomplete" | null
}

export type ResponsesContentPart =
  | { type: "input_text"; text: string }
  | {
      type: "input_image"
      image_url?: string | null
      file_id?: string | null
      detail?: "low" | "high" | "auto"
    }

// Tool types
export interface ResponsesTool {
  type: "function"
  name: string
  description?: string
  parameters?: Record<string, unknown>
  strict?: boolean
}

// Output item types (response)
export type ResponsesOutputItem =
  | ResponsesOutputMessage
  | ResponsesOutputFunctionCall
  | ResponsesOutputReasoning

export interface ResponsesOutputMessage {
  type: "message"
  id: string
  role: "assistant"
  content: Array<ResponsesOutputContentPart>
  status: "completed" | "incomplete" | "in_progress"
}

export interface ResponsesOutputFunctionCall {
  type: "function_call"
  id: string
  call_id: string
  name: string
  arguments: string
  status: "completed" | "incomplete" | "in_progress"
}

export interface ResponsesOutputReasoning {
  type: "reasoning"
  id: string
  encrypted_content?: string
  summary?: Array<{ type: "summary_text"; text: string }>
  status: "completed" | "incomplete" | "in_progress"
}

export type ResponsesOutputContentPart =
  | { type: "output_text"; text: string; annotations?: Array<unknown> }
  | { type: "refusal"; refusal: string }

// Response type
export interface ResponsesResponse {
  id: string
  object: "response"
  created_at: number
  model: string
  status: "completed" | "incomplete" | "in_progress" | "failed"
  output: Array<ResponsesOutputItem>
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
    input_tokens_details?: { cached_tokens?: number }
    output_tokens_details?: { reasoning_tokens?: number }
  }
  error?: { code: string; message: string } | null
  incomplete_details?: { reason: string } | null
  metadata?: Record<string, string> | null
  service_tier?: string
}
