import { describe, test, expect, mock, beforeEach } from "bun:test"

import type { state as StateType } from "../src/lib/state"
import type { getCopilotChatVersion as GetCopilotChatVersion } from "../src/services/get-copilot-chat-version"
import type { getVSCodeVersion as GetVSCodeVersion } from "../src/services/get-vscode-version"

// ---------------------------------------------------------------------------
// We test the modules by mocking global `fetch` before importing them.
// Each describe block re-imports after resetting the module registry so we
// get fresh module-level caches for every suite.
// ---------------------------------------------------------------------------

// Helpers ----------------------------------------------------------------

function makeFetchMock(handler: (url: string, init?: RequestInit) => Response) {
  return mock((url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url instanceof Request ? url.url : url.toString()
    return Promise.resolve(handler(urlStr, init))
  }) as unknown as typeof fetch
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  })
}

// Module type aliases for properly typed dynamic imports
type VSCodeVersionModule = { getVSCodeVersion: typeof GetVSCodeVersion }
type CopilotChatVersionModule = {
  getCopilotChatVersion: typeof GetCopilotChatVersion
}
type StateModule = { state: typeof StateType }

// ---------------------------------------------------------------------------
// getVSCodeVersion tests
// ---------------------------------------------------------------------------

describe("getVSCodeVersion", () => {
  let callCount = 0

  beforeEach(() => {
    callCount = 0
  })

  test("returns version from official VS Code API (primary path)", async () => {
    globalThis.fetch = makeFetchMock((_url) => {
      callCount++
      return jsonResponse(["1.99.0", "1.98.0"])
    })

    const mod = (await import(
      `../src/services/get-vscode-version.ts?t=${Date.now()}`
    )) as VSCodeVersionModule
    const version = await mod.getVSCodeVersion()
    expect(version).toBe("1.99.0")
    expect(callCount).toBe(1)
  })

  test("falls back to AUR when official API fails", async () => {
    let requestIndex = 0
    globalThis.fetch = makeFetchMock((_url) => {
      const i = requestIndex++
      if (i === 0) throw new Error("network error")
      // AUR PKGBUILD response
      return textResponse("pkgver=1.88.0\narch=(x86_64)")
    })

    const mod = (await import(
      `../src/services/get-vscode-version.ts?t=${Date.now() + 1}`
    )) as VSCodeVersionModule
    const version = await mod.getVSCodeVersion()
    expect(version).toBe("1.88.0")
  })

  test("returns hardcoded fallback when both official API and AUR fail", async () => {
    globalThis.fetch = makeFetchMock((_url) => {
      throw new Error("offline")
    })

    const mod = (await import(
      `../src/services/get-vscode-version.ts?t=${Date.now() + 2}`
    )) as VSCodeVersionModule
    const version = await mod.getVSCodeVersion()
    expect(version).toBe("1.104.3")
  })

  test("cache prevents second fetch within TTL", async () => {
    let fetchCallCount = 0
    globalThis.fetch = makeFetchMock((_url) => {
      fetchCallCount++
      return jsonResponse(["1.99.5"])
    })

    const mod = (await import(
      `../src/services/get-vscode-version.ts?t=${Date.now() + 3}`
    )) as VSCodeVersionModule

    const v1 = await mod.getVSCodeVersion()
    const v2 = await mod.getVSCodeVersion()

    expect(v1).toBe("1.99.5")
    expect(v2).toBe("1.99.5")
    // fetch should only have been called once
    expect(fetchCallCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// getCopilotChatVersion tests
// ---------------------------------------------------------------------------

describe("getCopilotChatVersion", () => {
  const MARKETPLACE_URL =
    "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery"

  const validMarketplaceResponse = {
    results: [
      {
        extensions: [
          {
            versions: [{ version: "0.30.1" }],
          },
        ],
      },
    ],
  }

  test("returns version from Marketplace API", async () => {
    globalThis.fetch = makeFetchMock((url) => {
      expect(url).toBe(MARKETPLACE_URL)
      return jsonResponse(validMarketplaceResponse)
    })

    const mod = (await import(
      `../src/services/get-copilot-chat-version.ts?t=${Date.now()}`
    )) as CopilotChatVersionModule
    const version = await mod.getCopilotChatVersion()
    expect(version).toBe("0.30.1")
  })

  test("returns hardcoded fallback on network error", async () => {
    globalThis.fetch = makeFetchMock((_url) => {
      throw new Error("connection refused")
    })

    const mod = (await import(
      `../src/services/get-copilot-chat-version.ts?t=${Date.now() + 1}`
    )) as CopilotChatVersionModule
    const version = await mod.getCopilotChatVersion()
    expect(version).toBe("0.26.7")
  })

  test("returns hardcoded fallback when API response has unexpected shape", async () => {
    globalThis.fetch = makeFetchMock((_url) => {
      return jsonResponse({ results: [] })
    })

    const mod = (await import(
      `../src/services/get-copilot-chat-version.ts?t=${Date.now() + 2}`
    )) as CopilotChatVersionModule
    const version = await mod.getCopilotChatVersion()
    expect(version).toBe("0.26.7")
  })

  test("cache prevents second fetch within TTL", async () => {
    let fetchCallCount = 0
    globalThis.fetch = makeFetchMock((_url) => {
      fetchCallCount++
      return jsonResponse(validMarketplaceResponse)
    })

    const mod = (await import(
      `../src/services/get-copilot-chat-version.ts?t=${Date.now() + 3}`
    )) as CopilotChatVersionModule

    const v1 = await mod.getCopilotChatVersion()
    const v2 = await mod.getCopilotChatVersion()

    expect(v1).toBe("0.30.1")
    expect(v2).toBe("0.30.1")
    expect(fetchCallCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// State interface test — shape check
// ---------------------------------------------------------------------------

describe("State type includes copilotChatVersion", () => {
  test("state object accepts copilotChatVersion field", async () => {
    const { state } = (await import(
      `../src/lib/state.ts?t=${Date.now()}`
    )) as StateModule
    // Field must be optionally present (undefined by default)
    expect(state.copilotChatVersion).toBeUndefined()

    // Should be assignable without TS errors (runtime check)
    state.copilotChatVersion = "0.26.7"
    expect(state.copilotChatVersion).toBe("0.26.7")
  })
})
