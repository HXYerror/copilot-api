import consola from "consola"

const FALLBACK = "0.26.7"
const CACHE_TTL = 24 * 60 * 60 * 1000

interface Cache {
  version: string
  fetchedAt: number
}

let cache: Cache | undefined

export async function getCopilotChatVersion(): Promise<string> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.version
  }

  let version: string

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 5000)

    try {
      const response = await fetch(
        "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json;api-version=3.0-preview.1",
          },
          body: JSON.stringify({
            filters: [
              {
                criteria: [{ filterType: 7, value: "GitHub.copilot-chat" }],
              },
            ],
            flags: 529,
          }),
          signal: controller.signal,
        },
      )

      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      const data = (await response.json()) as any
      const parsed: unknown =
        data?.results?.[0]?.extensions?.[0]?.versions?.[0]?.version
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

      if (typeof parsed !== "string" || !parsed) {
        throw new Error("Unexpected response shape")
      }

      version = parsed
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    consola.warn(
      "Failed to fetch Copilot Chat version from Marketplace, using fallback",
    )
    version = FALLBACK
  }

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    consola.warn(`Invalid version format received: ${version}, using fallback`)
    version = FALLBACK
  }

  if (version !== FALLBACK) {
    // eslint-disable-next-line require-atomic-updates
    cache = { version, fetchedAt: Date.now() }
  }
  // If version === FALLBACK, don't write cache — allow retry next call

  return version
}
