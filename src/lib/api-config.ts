import { randomUUID } from "node:crypto"

import type { State } from "./state"

export const standardHeaders = () => ({
  "content-type": "application/json",
  accept: "application/json",
})

const COPILOT_VERSION_FALLBACK = "0.26.7"

const API_VERSION = "2025-04-01"

export const copilotBaseUrl = (state: State) =>
  state.accountType === "individual" ?
    "https://api.githubcopilot.com"
  : `https://api.${state.accountType}.githubcopilot.com`

/**
 * Headers sent with every upstream request to mimic VS Code Copilot Chat traffic.
 *
 * Header sources:
 *  - Authorization        — Copilot token from GitHub OAuth flow
 *  - editor-version       — Auto-detected VS Code stable release (update.code.visualstudio.com)
 *  - editor-plugin-version — Auto-detected GitHub.copilot-chat Marketplace version
 *  - user-agent           — Same as editor-plugin-version, GitHubCopilotChat/<version>
 *  - copilot-integration-id — Fixed "vscode-chat"
 *  - openai-intent        — Fixed "conversation-panel"
 *  - x-github-api-version — Fixed "2025-04-01" (verify periodically against VS Code source)
 *  - x-request-id         — Per-request UUID via crypto.randomUUID()
 *  - x-vscode-user-agent-library-version — Fixed "electron-fetch"
 *  - copilot-vision-request — Added when request includes image content
 */
export const copilotHeaders = (state: State, vision: boolean = false) => {
  const copilotVersion = state.copilotChatVersion ?? COPILOT_VERSION_FALLBACK
  const headers: Record<string, string> = {
    Authorization: `Bearer ${state.copilotToken}`,
    "content-type": standardHeaders()["content-type"],
    "copilot-integration-id": "vscode-chat",
    "editor-version": `vscode/${state.vsCodeVersion}`,
    "editor-plugin-version": `copilot-chat/${copilotVersion}`,
    "user-agent": `GitHubCopilotChat/${copilotVersion}`,
    "openai-intent": "conversation-panel",
    "x-github-api-version": API_VERSION,
    "x-request-id": randomUUID(),
    "x-vscode-user-agent-library-version": "electron-fetch",
  }

  if (vision) headers["copilot-vision-request"] = "true"

  return headers
}

export const GITHUB_API_BASE_URL = "https://api.github.com"
export const githubHeaders = (state: State) => {
  const copilotVersion = state.copilotChatVersion ?? COPILOT_VERSION_FALLBACK
  return {
    ...standardHeaders(),
    authorization: `token ${state.githubToken}`,
    "editor-version": `vscode/${state.vsCodeVersion}`,
    "editor-plugin-version": `copilot-chat/${copilotVersion}`,
    "user-agent": `GitHubCopilotChat/${copilotVersion}`,
    "x-github-api-version": API_VERSION,
    "x-vscode-user-agent-library-version": "electron-fetch",
  }
}

export const GITHUB_BASE_URL = "https://github.com"
export const GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98"
export const GITHUB_APP_SCOPES = ["read:user"].join(" ")
