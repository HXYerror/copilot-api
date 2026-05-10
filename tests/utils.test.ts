import { describe, test, expect, mock, beforeEach } from "bun:test"

// ---------------------------------------------------------------------------
// cacheCopilotChatVersion & cacheVSCodeVersion — integration tests against
// the real state singleton, with service functions mocked.
// ---------------------------------------------------------------------------

// Mock the service modules before importing utils so bun's module registry
// picks up the mocks when utils.ts resolves its imports.
const mockGetCopilotChatVersion = mock(() => Promise.resolve("0.30.1"))
const mockGetVSCodeVersion = mock(() => Promise.resolve("1.99.0"))

void mock.module("../src/services/get-copilot-chat-version", () => ({
  getCopilotChatVersion: mockGetCopilotChatVersion,
}))

void mock.module("../src/services/get-vscode-version", () => ({
  getVSCodeVersion: mockGetVSCodeVersion,
}))

// Import after mocking so the mocks are active
import { state } from "../src/lib/state"
import { cacheCopilotChatVersion, cacheVSCodeVersion } from "../src/lib/utils"

describe("cacheCopilotChatVersion", () => {
  beforeEach(() => {
    // Reset state between tests
    state.copilotChatVersion = undefined
    state.vsCodeVersion = undefined
    mockGetCopilotChatVersion.mockReset()
    mockGetVSCodeVersion.mockReset()
  })

  test("sets state.copilotChatVersion with value from service", async () => {
    mockGetCopilotChatVersion.mockResolvedValue("0.30.1")

    expect(state.copilotChatVersion).toBeUndefined()
    await cacheCopilotChatVersion()
    expect(state.copilotChatVersion).toBe("0.30.1")
  })

  test("sets state.copilotChatVersion to fallback value returned by service", async () => {
    mockGetCopilotChatVersion.mockResolvedValue("0.26.7")

    await cacheCopilotChatVersion()
    expect(state.copilotChatVersion).toBe("0.26.7")
  })

  test("calls getCopilotChatVersion exactly once", async () => {
    mockGetCopilotChatVersion.mockResolvedValue("0.28.0")

    await cacheCopilotChatVersion()
    expect(mockGetCopilotChatVersion).toHaveBeenCalledTimes(1)
  })
})

describe("cacheVSCodeVersion", () => {
  beforeEach(() => {
    state.vsCodeVersion = undefined
    mockGetVSCodeVersion.mockReset()
  })

  test("sets state.vsCodeVersion with value from service", async () => {
    mockGetVSCodeVersion.mockResolvedValue("1.99.0")

    expect(state.vsCodeVersion).toBeUndefined()
    await cacheVSCodeVersion()
    expect(state.vsCodeVersion).toBe("1.99.0")
  })

  test("sets state.vsCodeVersion to fallback value returned by service", async () => {
    mockGetVSCodeVersion.mockResolvedValue("1.104.3")

    await cacheVSCodeVersion()
    expect(state.vsCodeVersion).toBe("1.104.3")
  })

  test("calls getVSCodeVersion exactly once", async () => {
    mockGetVSCodeVersion.mockResolvedValue("1.99.0")

    await cacheVSCodeVersion()
    expect(mockGetVSCodeVersion).toHaveBeenCalledTimes(1)
  })
})
