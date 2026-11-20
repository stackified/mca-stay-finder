import { useCallback, useEffect } from 'react'
import { dataUrl } from '@/lib/data'
import { loadLiveAir } from '@/lib/liveAirCache'
import { useAppStore } from './useAppStore'

/** localStorage may be missing or throw (private mode, blocked site data). */
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Loads live AQI once the seed data is in (1-hour cache, then Open-Meteo, then fallbacks).
 * Returns a reload function; `reload(true)` skips the fresh cache.
 */
export function useLiveAirLoader() {
  const data = useAppStore((s) => s.data)
  const setLive = useAppStore((s) => s.setLive)

  const load = useCallback(
    async (force = false) => {
      if (!data) return
      setLive({ loading: true, result: useAppStore.getState().live.result })
      const result = await loadLiveAir({
        points: data.cities.data.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })),
        storage: safeStorage(),
        force,
        loadSnapshot: async () => {
          const res = await fetch(dataUrl('aqi-live.json'))
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        },
      })
      setLive({ loading: false, result })
    },
    [data, setLive],
  )

  useEffect(() => {
    void load()
  }, [load])

  return load
}
