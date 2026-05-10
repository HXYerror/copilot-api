import { describe, test, expect, mock, beforeEach } from "bun:test"

import type { ModelsResponse } from "../src/services/copilot/get-models"

// ---------------------------------------------------------------------------
// cacheModels — integration test against the real state singleton,
// with the service function mocked.
// ---------------------------------------------------------------------------

const fakeModels: ModelsResponse = {
  object: "list",
  data: [],
}

const mockGetModels = mock(() => Promise.resolve(fakeModels))

void mock.module("../src/services/copilot/get-models", () => ({
  getModels: mockGetModels,
}))

// Import after mocking so the mocks are active
import { state } from "../src/lib/state"
import { cacheModels } from "../src/lib/utils"

describe("cacheModels", () => {
  beforeEach(() => {
    state.models = undefined
    mockGetModels.mockReset()
  })

  test("sets state.models with value from service", async () => {
    mockGetModels.mockResolvedValue(fakeModels)

    expect(state.models).toBeUndefined()
    await cacheModels()
    expect(state.models).toEqual(fakeModels)
  })

  test("calls getModels exactly once", async () => {
    mockGetModels.mockResolvedValue(fakeModels)

    await cacheModels()
    expect(mockGetModels).toHaveBeenCalledTimes(1)
  })
})
