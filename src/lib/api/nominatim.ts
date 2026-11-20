/**
 * Browser-side place search for "Add my listing" (SPEC §5: Nominatim, free, max 1 request/s,
 * cache results). Runs only when the owner presses Search — never while typing.
 * Only the typed search text and a map area are sent; no personal data.
 */
import type { LatLng } from '../geo'

export type PlaceHit = { label: string; lat: number; lng: number; type: string }

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const cache = new Map<string, PlaceHit[]>()
let lastRequest = 0

export async function searchPlaces(query: string, near?: LatLng): Promise<PlaceHit[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const key = `${q}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`
  const hit = cache.get(key)
  if (hit) return hit

  const wait = lastRequest + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequest = Date.now()

  const params = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'in', limit: '6' })
  if (near) {
    // Prefer results within ~30 km of the campus, without excluding others.
    const d = 0.3
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`)
  }
  const res = await fetch(`${ENDPOINT}?${params}`, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`Place search failed (HTTP ${res.status}). Click the map instead.`)
  const rows = (await res.json()) as {
    display_name: string
    lat: string
    lon: string
    type: string
  }[]
  const hits = rows.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
    type: r.type,
  }))
  cache.set(key, hits)
  return hits
}
