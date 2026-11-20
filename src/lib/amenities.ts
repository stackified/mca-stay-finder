/**
 * Amenities near campuses (SPEC §6.2 C, §9): grocery, hospital/clinic, pharmacy, gym,
 * bus stop, railway station, restaurant/mess. Data from OSM via scripts/fetch-osm-amenities.ts.
 * Pure helpers (no browser APIs) so the script and the app share them.
 */
import { z } from 'zod'
import { haversineKm, type LatLng } from './geo.ts'

export const AMENITY_KINDS = [
  'grocery',
  'hospital',
  'pharmacy',
  'gym',
  'bus_stop',
  'railway',
  'restaurant',
] as const
export type AmenityKind = (typeof AMENITY_KINDS)[number]

export const AMENITY_LABEL: Record<AmenityKind, string> = {
  grocery: 'Grocery',
  hospital: 'Hospital / clinic',
  pharmacy: 'Pharmacy',
  gym: 'Gym',
  bus_stop: 'Bus stop',
  railway: 'Railway station',
  restaurant: 'Restaurant / mess',
}

export const AMENITY_COLOR: Record<AmenityKind, string> = {
  grocery: '#16a34a',
  hospital: '#dc2626',
  pharmacy: '#e11d48',
  gym: '#9333ea',
  bus_stop: '#0284c7',
  railway: '#1e3a8a',
  restaurant: '#d97706',
}

/** Short text symbol on the map (colour is not the only signal). */
export const AMENITY_SYMBOL: Record<AmenityKind, string> = {
  grocery: 'G',
  hospital: '+',
  pharmacy: 'Rx',
  gym: 'F',
  bus_stop: 'B',
  railway: 'R',
  restaurant: 'E',
}

/** OSM tags → kind (first match wins), or null. */
export function amenityKind(tags: Record<string, string>): AmenityKind | null {
  const { amenity, shop, leisure, highway, railway, public_transport, healthcare } = tags
  if (railway === 'station' || railway === 'halt') return 'railway'
  if (
    amenity === 'hospital' ||
    amenity === 'clinic' ||
    amenity === 'doctors' ||
    healthcare === 'hospital' ||
    healthcare === 'clinic'
  ) {
    return 'hospital'
  }
  if (amenity === 'pharmacy' || healthcare === 'pharmacy' || shop === 'chemist') return 'pharmacy'
  if (
    shop === 'supermarket' ||
    shop === 'convenience' ||
    shop === 'greengrocer' ||
    shop === 'grocery'
  )
    return 'grocery'
  if (leisure === 'fitness_centre' || (leisure === 'sports_centre' && tags.sport === 'fitness'))
    return 'gym'
  if (
    highway === 'bus_stop' ||
    amenity === 'bus_station' ||
    (public_transport === 'platform' && tags.bus === 'yes')
  ) {
    return 'bus_stop'
  }
  if (
    amenity === 'restaurant' ||
    amenity === 'fast_food' ||
    amenity === 'food_court' ||
    amenity === 'cafe'
  ) {
    return 'restaurant'
  }
  return null
}

/** Compact record: [kind, lat, lng, name?] keeps public/data/amenities.json small. */
export const AmenityRowSchema = z.tuple([
  z.enum(AMENITY_KINDS),
  z.number(),
  z.number(),
  z.string().optional(),
])
export type AmenityRow = z.infer<typeof AmenityRowSchema>

export const AmenitiesFileSchema = z.object({
  meta: z.object({
    generatedAt: z.string(),
    generator: z.string(),
    sources: z.array(z.string()),
    radiusKm: z.number(),
    notes: z.array(z.string()).optional(),
  }),
  /** campusId → rows. */
  byCampus: z.record(z.string(), z.array(AmenityRowSchema)),
})
export type AmenitiesFile = z.infer<typeof AmenitiesFileSchema>

export type Amenity = { kind: AmenityKind; lat: number; lng: number; name?: string }
export const rowToAmenity = ([kind, lat, lng, name]: AmenityRow): Amenity => ({
  kind,
  lat,
  lng,
  ...(name && { name }),
})

/**
 * Grid index for "is there a <kind> within X m of this point?" — O(1) cells per query instead of
 * scanning every amenity. Cell ≈ 0.01° (~1.1 km); queries up to 2 km look at a 5×5 block.
 */
export class AmenityIndex {
  private cells = new Map<string, Amenity[]>()
  private static CELL = 0.01
  constructor(amenities: Iterable<Amenity>) {
    for (const a of amenities) {
      const k = AmenityIndex.key(a.lat, a.lng)
      const list = this.cells.get(k)
      if (list) list.push(a)
      else this.cells.set(k, [a])
    }
  }
  private static key(lat: number, lng: number) {
    return `${Math.floor(lat / AmenityIndex.CELL)}:${Math.floor(lng / AmenityIndex.CELL)}`
  }
  /** Nearest amenity of `kind` within `maxM` metres, or null. */
  nearest(p: LatLng, kind: AmenityKind, maxM: number): { amenity: Amenity; meters: number } | null {
    const r = Math.ceil(maxM / 1000 / 1.1 / 1) + 1
    const ci = Math.floor(p.lat / AmenityIndex.CELL)
    const cj = Math.floor(p.lng / AmenityIndex.CELL)
    let best: { amenity: Amenity; meters: number } | null = null
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        for (const a of this.cells.get(`${i}:${j}`) ?? []) {
          if (a.kind !== kind) continue
          const m = haversineKm(p, a) * 1000
          if (m <= maxM && (!best || m < best.meters)) best = { amenity: a, meters: m }
        }
      }
    }
    return best
  }
  has(p: LatLng, kind: AmenityKind, maxM: number): boolean {
    return this.nearest(p, kind, maxM) !== null
  }
}
