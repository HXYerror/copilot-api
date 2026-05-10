# VS Code Header Simulation Accuracy

## Status
Approved

## Overview
Auto-detect and keep current the VS Code + Copilot Chat version strings used in every upstream request header, so traffic looks indistinguishable from a real VS Code editor session.

## Motivation
copilot-api impersonates VS Code Copilot Chat toward GitHub's upstream. Hardcoded version strings become stale as VS Code releases new versions every month. Stale strings increase the distinguishability of copilot-api traffic from legitimate editor traffic. The fix: query live version sources at startup, cache them, and fall back to hardcoded values on failure — so headers always reflect the latest shipping release.

## Requirements

1. **VS Code version auto-detect** — On startup, query `https://update.code.visualstudio.com/api/releases/stable` (JSON array, first element is latest stable version). Use the result for `editor-version: vscode/<version>`.
2. **Copilot Chat extension version auto-detect** — On startup, query the VS Code Marketplace API for `GitHub.copilot-chat` and extract the latest version. Use it for `editor-plugin-version: copilot-chat/<version>` and `user-agent: GitHubCopilotChat/<version>`.
3. **24-hour TTL in-memory cache** — Cache both versions for 24 h so repeated token refreshes don't re-query external APIs unnecessarily.
4. **Graceful fallback** — If either fetch fails (network error, timeout, unexpected shape), log a warning and continue with the existing hardcoded fallback values. Never crash startup.
5. **Startup log** — At `consola.info` level, print the resolved version strings (`VSCode: X.Y.Z`, `Copilot Chat: A.B.C`) so the user can verify what's being used.
6. **`x-request-id`** — Confirm it is already generated per-request via `crypto.randomUUID()` (it is — no change needed).
7. **Header documentation** — Add a comment block in `src/lib/api-config.ts` explaining each header's source and how to update it.

## Acceptance Criteria

- On a clean startup with network access, printed versions match the latest stable VS Code release visible at `https://code.visualstudio.com/updates/`.
- On startup with network blocked, a warning is logged and the server still starts with fallback values.
- No new CLI flags required — version detection is automatic.
- All existing tests pass.

## Technical Approach

### VS Code version
`GET https://update.code.visualstudio.com/api/releases/stable` returns a JSON array of version strings. Take `[0]`.

### Copilot Chat version
VS Code Marketplace API:
```
GET https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery
Content-Type: application/json
Accept: application/json;api-version=3.0-preview.1

Body: {
  "filters": [{ "criteria": [{ "filterType": 7, "value": "GitHub.copilot-chat" }] }],
  "flags": 529
}
```
Response path: `results[0].extensions[0].versions[0].version`

### Caching
Simple module-level `{ version: string, fetchedAt: number }` objects. If `Date.now() - fetchedAt < 24 * 60 * 60 * 1000`, return cached value.

### File changes
- `src/services/get-vscode-version.ts` — extend with VS Code stable API; keep AUR fallback as secondary fallback.
- `src/services/get-copilot-chat-version.ts` — new file for Copilot Chat extension version.
- `src/lib/utils.ts` — `cacheVSCodeVersion()` also calls `cacheCopilotChatVersion()`.
- `src/lib/state.ts` — add `copilotChatVersion?: string`.
- `src/lib/api-config.ts` — use `state.copilotChatVersion` for `editor-plugin-version` and `user-agent`; add header documentation comment.

## Testing Strategy
- Unit test `get-vscode-version.ts`: mock fetch → returns parsed version; mock fail → returns fallback.
- Unit test `get-copilot-chat-version.ts`: mock fetch → returns parsed version; mock fail → returns fallback.
- Existing translation tests must continue to pass.

## Out of Scope
- `OpenAI-Organization` header (not confirmed in VS Code traffic).
- `X-Vscode-User-Agent-Library-Comment` (not confirmed).
- Persistent disk cache (in-memory TTL is sufficient for a single server process).
- Auto-restart on version change.
