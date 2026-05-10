import consola from "consola"

const FALLBACK = "1.104.3"
const CACHE_TTL = 24 * 60 * 60 * 1000

interface Cache {
  version: string
  fetchedAt: number
}

let cache: Cache | undefined

async function fetchFromOfficialApi(): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 5000)

  try {
    const response = await fetch(
      "https://update.code.visualstudio.com/api/releases/stable",
      { signal: controller.signal },
    )

    const versions = (await response.json()) as Array<string>

    if (Array.isArray(versions) && versions.length > 0 && versions[0]) {
      return versions[0]
    }

    throw new Error("Unexpected response shape")
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchFromAur(): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 5000)

  try {
    const response = await fetch(
      "https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=visual-studio-code-bin",
      { signal: controller.signal },
    )

    const pkgbuild = await response.text()
    const match = pkgbuild.match(/pkgver=(\d+\.\d+\.\d+)/)

    if (match?.[1]) {
      return match[1]
    }

    throw new Error("Version not found in PKGBUILD")
  } finally {
    clearTimeout(timeout)
  }
}

export async function getVSCodeVersion(): Promise<string> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.version
  }

  let version: string

  try {
    version = await fetchFromOfficialApi()
  } catch {
    try {
      version = await fetchFromAur()
    } catch {
      consola.warn(
        "Failed to fetch VS Code version from all sources, using fallback",
      )
      version = FALLBACK
    }
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
