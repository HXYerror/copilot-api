import { getModels } from "~/services/copilot/get-models"
import { getCopilotChatVersion } from "~/services/get-copilot-chat-version"
import { getVSCodeVersion } from "~/services/get-vscode-version"

import { state } from "./state"

export const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export const isNullish = (value: unknown): value is null | undefined =>
  value === null || value === undefined

export async function cacheModels(): Promise<void> {
  const models = await getModels()
  state.models = models
}

export const cacheCopilotChatVersion = async () => {
  const version = await getCopilotChatVersion()
  state.copilotChatVersion = version
}

export const cacheVSCodeVersion = async () => {
  const version = await getVSCodeVersion()
  state.vsCodeVersion = version
}
