import { describe, test, expect, mock, beforeAll, beforeEach } from "bun:test"

import { state } from "../src/lib/state"
import { server } from "../src/server"

// ---------------------------------------------------------------------------
// Global fetch mock — returns a minimal non-streaming Responses API response
// ---------------------------------------------------------------------------

const mockResponseBody = {
  id: "resp_test",
  object: "response",
  created_at: 1_700_000_000,
  model: "gpt-4o",
  status: "completed",
  output: [],
}

const fetchMock = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockResponseBody),
  }),
)

// @ts-expect-error – mock doesn't implement full fetch signature
;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock

// Set up copilot token so createResponses doesn't throw
beforeAll(() => {
  state.copilotToken = "test-token"
  state.vsCodeVersion = "1.99.0"
  state.accountType = "individual"
  state.manualApprove = false
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /v1/responses — wired handler", () => {
  test("non-streaming request returns upstream JSON", async () => {
    const res = await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", input: [], stream: false }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as typeof mockResponseBody
    expect(body.object).toBe("response")
    expect(body.id).toBe("resp_test")
  })

  test("same endpoint reachable at bare /responses path", async () => {
    const res = await server.request("/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", input: [], stream: false }),
    })
    expect(res.status).toBe(200)
  })

  test("invalid JSON body returns 400", async () => {
    const res = await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      error: { type: string; code: string }
    }
    expect(body.error.type).toBe("invalid_request_error")
    expect(body.error.code).toBe("invalid_json")
  })

  test("missing copilot token returns 500", async () => {
    // Temporarily clear the token — write is synchronous, no await in between.
    state.copilotToken = undefined

    const res = await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", input: [] }),
    })
    expect(res.status).toBe(500)

    state.copilotToken = "test-token"
  })
})

// ---------------------------------------------------------------------------
// createResponses behavior: X-Initiator header and error propagation
// ---------------------------------------------------------------------------

describe("createResponses behavior", () => {
  // Restore state before each test in this block
  beforeEach(() => {
    state.copilotToken = "test-token"
    state.vsCodeVersion = "1.99.0"
    state.accountType = "individual"
    state.manualApprove = false
  })

  test("X-Initiator = agent when assistant message present", async () => {
    const captureMock = mock(
      (_url: string, opts: { headers: Record<string, string> }) =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponseBody),
          headers: opts.headers,
        }),
    )
    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = captureMock

    await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: false,
        input: [
          { type: "message", role: "user", content: "hello" },
          { type: "message", role: "assistant", content: "hi there" },
        ],
      }),
    })

    expect(captureMock).toHaveBeenCalled()
    const sentHeaders = (
      captureMock.mock.calls[0][1] as { headers: Record<string, string> }
    ).headers
    expect(sentHeaders["X-Initiator"]).toBe("agent")

    // Restore default mock
    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = fetchMock
  })

  test("X-Initiator = user for pure user messages", async () => {
    const captureMock = mock(
      (_url: string, opts: { headers: Record<string, string> }) =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponseBody),
          headers: opts.headers,
        }),
    )
    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = captureMock

    await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: false,
        input: [{ type: "message", role: "user", content: "just a user" }],
      }),
    })

    expect(captureMock).toHaveBeenCalled()
    const sentHeaders = (
      captureMock.mock.calls[0][1] as { headers: Record<string, string> }
    ).headers
    expect(sentHeaders["X-Initiator"]).toBe("user")

    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = fetchMock
  })

  test("X-Initiator = agent for function_call_output item", async () => {
    const captureMock = mock(
      (_url: string, opts: { headers: Record<string, string> }) =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponseBody),
          headers: opts.headers,
        }),
    )
    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = captureMock

    await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: false,
        input: [
          { type: "function_call_output", call_id: "call_1", output: "{}" },
        ],
      }),
    })

    expect(captureMock).toHaveBeenCalled()
    const sentHeaders = (
      captureMock.mock.calls[0][1] as { headers: Record<string, string> }
    ).headers
    expect(sentHeaders["X-Initiator"]).toBe("agent")

    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = fetchMock
  })

  test("upstream 4xx returns error response", async () => {
    const errorMock = mock(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        text: () => Promise.resolve("rate limited"),
      }),
    )
    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = errorMock

    const res = await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", stream: false, input: [] }),
    })

    expect(res.status).toBe(429)

    // @ts-expect-error – mock doesn't implement full fetch signature
    globalThis.fetch = fetchMock
  })
})
