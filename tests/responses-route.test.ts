import { describe, test, expect } from "bun:test"

import { server } from "../src/server"

describe("POST /v1/responses stub", () => {
  test("returns 501 with structured error body", async () => {
    const res = await server.request("/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", input: [] }),
    })
    expect(res.status).toBe(501)
    const body = (await res.json()) as {
      error: { type: string; code: string; message: string }
    }
    expect(body.error.type).toBe("not_implemented")
    expect(body.error.code).toBe("responses_not_implemented")
    expect(typeof body.error.message).toBe("string")
  })

  test("bare /responses path also returns 501", async () => {
    const res = await server.request("/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", input: [] }),
    })
    expect(res.status).toBe(501)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("responses_not_implemented")
  })

  test("empty body returns 501 (not 500)", async () => {
    const res = await server.request("/v1/responses", {
      method: "POST",
      // no body
    })
    expect(res.status).toBe(501)
  })
})
