/**
 * Small geo helpers. Pure functions, no imports: the Node data scripts load this file directly.
 * Turf.js comes in Phase 4 for rings and point-in-polygon.
 */

export type LatLng = { lat: number; lng: number }

/** Home city centre. City level only, never a street address (SPEC §2, §12). */
export const HOME_CITY = { name: 'Surat', lat: 21.1702, lng: 72.8311 } as const

const EARTH_RADIUS_KM = 6371.0088

/** Great-circle distance in km (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Point `km` away from `from` on a bearing (degrees from north). Spherical earth. */
export function destination(from: LatLng, km: number, bearingDeg: number): LatLng {
  const rad = Math.PI / 180
  const d = km / EARTH_RADIUS_KM
  const b = bearingDeg * rad
  const lat1 = from.lat * rad
  const lng1 = from.lng * rad
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )
  return { lat: lat2 / rad, lng: ((lng2 / rad + 540) % 360) - 180 }
}

/** Closed ring polygon (GeoJSON order [lng, lat]) of radius `km` around `centre`. */
export function circleRing(centre: LatLng, km: number, steps = 96): [number, number][] {
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const p = destination(centre, km, (i / steps) * 360)
    ring.push([p.lng, p.lat])
  }
  return ring
}

/** Road-distance fallback when no routing API is used (SPEC §5: straight line × 1.3). */
export const ROAD_FACTOR = 1.3
