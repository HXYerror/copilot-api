const FALLBACK = "0.26.7"
const CACHE_TTL = 24 * 60 * 60 * 1000

interface Cache {
  version: string
  fetchedAt: number
}

let cache: Cache | undefined

interface MarketplaceVersion {
  version: string
}

interface MarketplaceExtension {
  versions: Array<MarketplaceVersion>
}

interface MarketplaceResult {
  extensions: Array<MarketplaceExtension>
}

interface MarketplaceResponse {
  results: Array<MarketplaceResult>
}

export async function getCopilotChatVersion(): Promise<string> {
  const cached = cache
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.version
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

      const data = (await response.json()) as MarketplaceResponse
      const parsed = data.results[0]?.extensions[0]?.versions[0]?.version

      if (typeof parsed !== "string" || !parsed) {
        throw new Error("Unexpected response shape")
      }

      version = parsed
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    version = FALLBACK
  }

  // eslint-disable-next-line require-atomic-updates
  cache = { version, fetchedAt: Date.now() }
  return version
}
