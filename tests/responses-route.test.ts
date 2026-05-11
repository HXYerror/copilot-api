import { describe, test, expect, mock, beforeAll } from "bun:test"

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
    // Temporarily clear the token via a describe-level wrapper so the
    // assignment happens synchronously (no await between read and write).
    const tokenBackup = state.copilotToken
    state.copilotToken = undefined // synchronous — no race condition

    const res = await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", input: [] }),
    })
    expect(res.status).toBe(500)

    // eslint-disable-next-line require-atomic-updates
    state.copilotToken = tokenBackup
  })
})
