/**
 * Turns domain data into map-ready values. Pure functions (unit-tested).
 */
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { City, Locality, StayType } from '@/types/domain'
import { circleRing, haversineKm, type LatLng } from './geo'
import { STAY_TYPE_COLOR, STAY_TYPE_SYMBOL, type StayResult } from './stays'
import { naqiBand, naqiColor, type NaqiBand } from './naqi'
import { scoreBand, type RankedCollege, type ScoreBand } from './scoring'

export type CityAqiProps = {
  id: string
  name: string
  aqi: number
  band: NaqiBand
  color: string
  label: string
}

export type CityAqiCollection = FeatureCollection<Point, CityAqiProps>

/** One point per city with a known annual AQI. Cities without data are left out. */
export function citiesToAqiGeoJSON(cities: readonly City[]): CityAqiCollection {
  const features: CityAqiCollection['features'] = []
  for (const c of cities) {
    const aqi = c.annualAQI.value
    if (aqi === null) continue
    const rounded = Math.round(aqi)
    const approx = c.annualAQI.confidence === 'estimate' ? '~' : ''
    features.push({
      type: 'Feature',
      id: c.id,
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        id: c.id,
        name: c.name,
        aqi: rounded,
        band: naqiBand(rounded),
        color: naqiColor(rounded),
        // Text label so colour is not the only signal (SPEC §12).
        label: `${shortName(c.name)}\nAQI ${approx}${rounded} · ${naqiBand(rounded)}`,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

/** "Delhi (Narela)" → "Delhi". */
const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '')

export type CollegeMarkerModel = RankedCollege & {
  band: ScoreBand
  sizePx: number
  isBackup: boolean
}

/** Marker diameter from seats (SPEC §6.3: size = seats). Unknown seats → smallest size. */
export function markerSize(seats: number | null): number {
  if (seats === null) return 22
  return Math.round(Math.min(40, 22 + Math.sqrt(seats) * 1.2))
}

// ---------- Stays, ring, localities (Phase 4) ----------

export type StayProps = {
  id: string
  name: string
  type: StayType
  color: string
  symbol: string
  /** Own listing (SPEC §6.5). */
  mine: boolean
  /** On the shortlist (SPEC §6.3 "badge if shortlisted"). */
  starred: boolean
}

/** Stay points for the clustered GL source. */
export function staysToGeoJSON(
  rows: readonly StayResult[],
  starredKeys: ReadonlySet<string> = new Set(),
): FeatureCollection<Point, StayProps> {
  return {
    type: 'FeatureCollection',
    features: rows.map(({ stay: s }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        type: s.type,
        color: STAY_TYPE_COLOR[s.type],
        symbol: STAY_TYPE_SYMBOL[s.type],
        mine: s.source === 'mine',
        starred: starredKeys.has(`stay:${s.id}`),
      },
    })),
  }
}

/** Radius ring around the selected campus (SPEC §6.3). */
export function ringGeoJSON(centre: LatLng, km: number): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: { km },
    geometry: { type: 'Polygon', coordinates: [circleRing(centre, km)] },
  }
}

/** [[west, south], [east, north]] of the ring, for fitBounds. */
export function ringBounds(centre: LatLng, km: number): [[number, number], [number, number]] {
  const ring = circleRing(centre, km, 16)
  const lngs = ring.map((p) => p[0])
  const lats = ring.map((p) => p[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

export const FIT_LABEL: Record<Locality['fit'], string> = {
  best: 'Best fit',
  budget: 'Budget',
  comfort: 'Comfort',
  ok: 'OK',
  'too-far': 'Too far',
}

export type LocalityProps = { id: string; label: string; fit: Locality['fit'] }

export function localitiesToGeoJSON(
  localities: readonly Locality[],
): FeatureCollection<Point, LocalityProps> {
  return {
    type: 'FeatureCollection',
    features: localities.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: { id: l.id, fit: l.fit, label: `${shortArea(l.name)}\n${FIT_LABEL[l.fit]}` },
    })),
  }
}

/** "Hanamkonda (Subedari / Nakkalagutta)" → "Hanamkonda"; "Kotra / Mata Mandir" → "Kotra". */
export const shortArea = (name: string) => name.split(/[(/]/)[0]!.trim()

/** Area name used for rental-site searches: nearest SPEC locality within 2 km, else the city. */
export function stayArea(
  point: LatLng,
  localities: readonly Locality[],
  city: City | undefined,
): string {
  const near = localities
    .map((l) => ({ l, d: haversineKm(point, l) }))
    .filter((x) => x.d <= 2)
    .sort((a, b) => a.d - b.d)[0]?.l
  return near ? shortArea(near.name) : shortName(city?.name ?? '')
}

/** Adds marker styling to ranked results. */
export const toMarkerModels = (rows: readonly RankedCollege[]): CollegeMarkerModel[] =>
  rows.map((r) => ({
    ...r,
    band: scoreBand(r.final),
    sizePx: markerSize(r.college.seats.value),
    isBackup: r.college.type === 'VIT',
  }))
