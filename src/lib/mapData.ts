/**
 * Turns domain data into map-ready values. Pure functions (unit-tested).
 */
import type { FeatureCollection, Point } from 'geojson'
import type { City, College } from '@/types/domain'
import { naqiBand, naqiColor, type NaqiBand } from './naqi'
import { finalScore, scoreBand, type ScoreBand } from './scoring'

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

export type CollegeMarkerModel = {
  college: College
  city: City | undefined
  score: number | null
  band: ScoreBand
  sizePx: number
  isBackup: boolean
}

/** Marker diameter from seats (SPEC §6.3: size = seats). Unknown seats → smallest size. */
export function markerSize(seats: number | null): number {
  if (seats === null) return 22
  return Math.round(Math.min(40, 22 + Math.sqrt(seats) * 1.2))
}

/**
 * Default visibility before Phase 3 filters exist:
 * hide IIIT (behind a toggle) and colleges in excluded cities (SPEC §2).
 */
export function collegeMarkers(
  colleges: readonly College[],
  cities: readonly City[],
  opts: { showIIIT: boolean; showExcluded: boolean } = { showIIIT: false, showExcluded: false },
): CollegeMarkerModel[] {
  const cityById = new Map(cities.map((c) => [c.id, c]))
  return colleges
    .filter((c) => opts.showIIIT || c.type !== 'IIIT')
    .filter((c) => opts.showExcluded || !cityById.get(c.cityId)?.excluded)
    .map((college) => {
      const score = finalScore(college.defaultScores)
      return {
        college,
        city: cityById.get(college.cityId),
        score,
        band: scoreBand(score),
        sizePx: markerSize(college.seats.value),
        isBackup: college.type === 'VIT',
      }
    })
}
