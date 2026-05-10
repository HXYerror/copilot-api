export const VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface VersionCache {
  version: string
  fetchedAt: number
}
