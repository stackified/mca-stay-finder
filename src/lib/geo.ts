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

/** Road-distance fallback when no routing API is used (SPEC §5: straight line × 1.3). */
export const ROAD_FACTOR = 1.3
