import { describe, test, expect } from "bun:test"

import type { ResponsesResponse } from "../src/routes/responses/types"

import { sanitiseResponsesOutput } from "../src/routes/responses/translation"

// Minimal valid response fixture
function makeResponse(output: ResponsesResponse["output"]): ResponsesResponse {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1_700_000_000,
    model: "gpt-5",
    status: "completed",
    output,
  }
}

describe("sanitiseResponsesOutput", () => {
  test("preserves encrypted_content on reasoning items", () => {
    const response = makeResponse([
      {
        type: "reasoning",
        id: "rs_abc",
        encrypted_content: "opaque-blob-xyz",
        summary: [{ type: "summary_text", text: "thought about it" }],
        status: "completed",
      },
    ])
    const result = sanitiseResponsesOutput(response)
    const reasoning = result.output[0] as { encrypted_content?: string }
    expect(reasoning.encrypted_content).toBe("opaque-blob-xyz")
  })

  test("strips status: null from reasoning items", () => {
    const response = makeResponse([
      {
        type: "reasoning",
        id: "rs_null_status",
        encrypted_content: "blob",
        // status is null — TypeScript won't allow this directly but upstream sends it
      } as unknown as ResponsesResponse["output"][0],
    ])

    const result = sanitiseResponsesOutput(response)
    const item = result.output[0] as Record<string, unknown>
    expect("status" in item).toBe(false)
  })

  test("preserves non-null status on reasoning items", () => {
    const response = makeResponse([
      {
        type: "reasoning",
        id: "rs_completed",
        status: "completed",
      },
    ])
    const result = sanitiseResponsesOutput(response)
    expect((result.output[0] as { status: string }).status).toBe("completed")
  })

  test("passes message items through unchanged", () => {
    const response = makeResponse([
      {
        type: "message",
        id: "msg_1",
        role: "assistant",
        content: [{ type: "output_text", text: "hello" }],
        status: "completed",
      },
    ])
    const result = sanitiseResponsesOutput(response)
    expect(result.output[0]).toEqual(response.output[0])
  })

  test("passes function_call items through unchanged", () => {
    const response = makeResponse([
      {
        type: "function_call",
        id: "fc_1",
        call_id: "call_abc",
        name: "get_weather",
        arguments: '{"city":"London"}',
        status: "completed",
      },
    ])
    const result = sanitiseResponsesOutput(response)
    expect(result.output[0]).toEqual(response.output[0])
  })

  test("handles empty output array", () => {
    const response = makeResponse([])
    const result = sanitiseResponsesOutput(response)
    expect(result.output).toEqual([])
  })

  test("top-level response fields are preserved", () => {
    const response = makeResponse([])
    response.usage = { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
    const result = sanitiseResponsesOutput(response)
    expect(result.usage).toEqual(response.usage)
    expect(result.id).toBe("resp_test")
    expect(result.model).toBe("gpt-5")
  })

  test("multiple mixed output items all sanitised", () => {
    const response = makeResponse([
      {
        type: "reasoning",
        id: "rs_1",
        encrypted_content: "secret",
        status: null as unknown as "completed",
      },
      {
        type: "message",
        id: "msg_1",
        role: "assistant",
        content: [{ type: "output_text", text: "answer" }],
        status: "completed",
      },
    ])
    const result = sanitiseResponsesOutput(response)
    // First item: status stripped, encrypted_content preserved
    const first = result.output[0] as Record<string, unknown>
    expect("status" in first).toBe(false)
    expect(first["encrypted_content"]).toBe("secret")
    // Second item: unchanged
    expect(result.output[1]).toEqual(response.output[1])
  })
})
