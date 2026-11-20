/**
 * Live AQI with a 1-hour cache and graceful fallback (SPEC §5, §12, §13):
 *   1. fresh browser cache (< 1 h)        → source "cache"
 *   2. Open-Meteo                         → source "live"
 *   3. older browser cache                → source "stale-cache"  (banner)
 *   4. public/data/aqi-live.json snapshot → source "snapshot"     (banner)
 *   5. nothing                            → source "none"         (banner; live filter disabled)
 * Pure apart from the injected fetch / storage / clock, so it is unit-tested.
 */
import {
  fetchLiveAir,
  LIVE_TTL_MS,
  LiveAirFileSchema,
  type LiveAirFile,
  type Point,
} from './liveAir'

export const CACHE_KEY = 'mca-live-air-v1'

export type LiveSource = 'cache' | 'live' | 'stale-cache' | 'snapshot' | 'none'
export type LiveResult = { data: LiveAirFile | null; source: LiveSource; error?: string }

type Store = Pick<Storage, 'getItem' | 'setItem'>

function readCache(storage: Store | null): LiveAirFile | null {
  try {
    const raw = storage?.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = LiveAirFileSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null // private mode, blocked storage or bad JSON
  }
}

function writeCache(storage: Store | null, data: LiveAirFile) {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked: the app still works, just without the cache.
  }
}

/** True when the cache covers every requested city (a new city means a refetch). */
const covers = (d: LiveAirFile, points: readonly Point[]) => points.every((p) => p.id in d.byCity)

export async function loadLiveAir(opts: {
  points: readonly Point[]
  fetchFn?: typeof fetch
  storage?: Store | null
  now?: () => number
  loadSnapshot?: () => Promise<unknown>
  /** Skip the fresh cache (manual refresh). */
  force?: boolean
}): Promise<LiveResult> {
  const { points, storage = null, now = Date.now } = opts
  const cached = readCache(storage)
  const age = cached ? now() - Date.parse(cached.fetchedAt) : Infinity
  if (!opts.force && cached && age < LIVE_TTL_MS && covers(cached, points)) {
    return { data: cached, source: 'cache' }
  }

  let error: string | undefined
  try {
    const fresh = await fetchLiveAir(points, opts.fetchFn)
    writeCache(storage, fresh)
    return { data: fresh, source: 'live' }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (cached) return { data: cached, source: 'stale-cache', error }

  if (opts.loadSnapshot) {
    try {
      const snap = LiveAirFileSchema.parse(await opts.loadSnapshot())
      return { data: snap, source: 'snapshot', error }
    } catch {
      // fall through
    }
  }
  return { data: null, source: 'none', error }
}
