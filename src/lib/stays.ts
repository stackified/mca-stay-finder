/**
 * Stay filters (SPEC §6.2 C). Pure functions, unit-tested.
 * Same rules as college filters: AND logic; a filter at its default is off; when on,
 * a missing value fails (OSM has no price/food/AC data — only your own listings can match those).
 */
import type { Range, Stay, StayType } from '@/types/domain'
import { haversineKm, ROAD_FACTOR, type LatLng } from './geo'

export const ALL_STAY_TYPES: StayType[] = [
  'pg',
  'hostel',
  'guest_house',
  'apartment',
  'bungalow',
  'campus_hostel',
  'unknown',
]
/** SPEC §6.2 C default: PG + Flat + Bungalow. */
export const DEFAULT_STAY_TYPES: StayType[] = ['pg', 'apartment', 'bungalow']

export const STAY_TYPE_LABEL: Record<StayType, string> = {
  pg: 'PG',
  hostel: 'Hostel (private)',
  guest_house: 'Guest house',
  apartment: 'Apartment / flat',
  bungalow: 'Bungalow / house',
  campus_hostel: 'Campus hostel',
  unknown: 'Other / unknown',
}

/** One-letter map symbol per type (colour is not the only signal). */
export const STAY_TYPE_SYMBOL: Record<StayType, string> = {
  pg: 'P',
  hostel: 'H',
  guest_house: 'G',
  apartment: 'A',
  bungalow: 'B',
  campus_hostel: 'C',
  unknown: '?',
}

export const STAY_TYPE_COLOR: Record<StayType, string> = {
  pg: '#7c3aed',
  hostel: '#db2777',
  guest_house: '#ea580c',
  apartment: '#2563eb',
  bungalow: '#0d9488',
  campus_hostel: '#4b5563',
  unknown: '#9ca3af',
}

export const ALL_SHARING = ['single', 'double', 'triple'] as const
export const ALL_FURNISHED = ['none', 'semi', 'full'] as const
export const ALL_GENDER = ['boys', 'girls', 'coliving', 'any'] as const
export const ALL_SOURCES = ['osm', 'mine'] as const

export type StayFilterState = {
  stayTypes: StayType[]
  stayMaxDistanceKm: number
  stayTravelMaxMin: number | null
  stayBudgetMin: number | null
  stayBudgetMax: number | null
  stayRentMin: number | null
  stayRentMax: number | null
  staySharing: (typeof ALL_SHARING)[number][]
  stayFoodOnly: boolean
  stayAcOnly: boolean
  stayFurnished: (typeof ALL_FURNISHED)[number][]
  /** "any" also matches stays whose gender is not stated. */
  stayGender: (typeof ALL_GENDER)[number][]
  staySources: (typeof ALL_SOURCES)[number][]
}

export const DEFAULT_STAY_FILTERS: Readonly<StayFilterState> = {
  stayTypes: [...DEFAULT_STAY_TYPES],
  stayMaxDistanceKm: 5,
  stayTravelMaxMin: null,
  stayBudgetMin: null,
  stayBudgetMax: null,
  stayRentMin: null,
  stayRentMax: null,
  staySharing: [...ALL_SHARING],
  stayFoodOnly: false,
  stayAcOnly: false,
  stayFurnished: [...ALL_FURNISHED],
  stayGender: [...ALL_GENDER],
  staySources: [...ALL_SOURCES],
}

/** Assumed city speed for the commute estimate (auto / bus). */
export const CITY_SPEED_KMH = 20
export const WALK_SPEED_KMH = 5

/** Road km from straight-line km (SPEC §5 fallback: × 1.3). */
export const roadKm = (straightKm: number) => straightKm * ROAD_FACTOR

/** Commute estimate in minutes by auto/bus. */
export const commuteMinutes = (straightKm: number) =>
  Math.round((roadKm(straightKm) / CITY_SPEED_KMH) * 60)

export const walkMinutes = (straightKm: number) =>
  Math.round((roadKm(straightKm) / WALK_SPEED_KMH) * 60)

/** All-in monthly cost range: own price if known, else the estimate. */
export const stayAllIn = (s: Stay): Range | undefined =>
  s.allInEstimate ?? (s.rent !== undefined ? { min: s.rent, max: s.rent } : undefined)

const sameSet = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

export type StayFilterId =
  | 'distance'
  | 'types'
  | 'sources'
  | 'travel'
  | 'budget'
  | 'rent'
  | 'sharing'
  | 'food'
  | 'ac'
  | 'furnished'
  | 'gender'

/** Stay-filter ids that differ from the defaults (distance always applies, so it is left out). */
export function changedStayFilters(f: StayFilterState): StayFilterId[] {
  const d = DEFAULT_STAY_FILTERS
  const out: StayFilterId[] = []
  if (!sameSet(f.stayTypes, d.stayTypes)) out.push('types')
  if (!sameSet(f.staySources, d.staySources)) out.push('sources')
  if (f.stayTravelMaxMin !== null) out.push('travel')
  if (f.stayBudgetMin !== null || f.stayBudgetMax !== null) out.push('budget')
  if (f.stayRentMin !== null || f.stayRentMax !== null) out.push('rent')
  if (!sameSet(f.staySharing, d.staySharing)) out.push('sharing')
  if (f.stayFoodOnly) out.push('food')
  if (f.stayAcOnly) out.push('ac')
  if (!sameSet(f.stayFurnished, d.stayFurnished)) out.push('furnished')
  if (!sameSet(f.stayGender, d.stayGender)) out.push('gender')
  return out
}

type Pred = (s: Stay, f: StayFilterState, distanceKm: number) => boolean

const PREDICATES: Record<Exclude<StayFilterId, 'distance'>, Pred> = {
  types: (s, f) => f.stayTypes.includes(s.type),
  sources: (s, f) => f.staySources.includes(s.source),
  travel: (_s, f, d) => commuteMinutes(d) <= f.stayTravelMaxMin!,
  budget: (s, f) => {
    const r = stayAllIn(s)
    if (!r) return false
    // Overlap: the stay can fit the budget somewhere in its range.
    return (
      (f.stayBudgetMin === null || r.max >= f.stayBudgetMin) &&
      (f.stayBudgetMax === null || r.min <= f.stayBudgetMax)
    )
  },
  rent: (s, f) =>
    s.rent !== undefined &&
    (f.stayRentMin === null || s.rent >= f.stayRentMin) &&
    (f.stayRentMax === null || s.rent <= f.stayRentMax),
  // SPEC: sharing is a PG filter; other types are not affected by it.
  sharing: (s, f) =>
    !(s.type === 'pg' || s.type === 'hostel') ||
    (s.sharing !== undefined && f.staySharing.includes(s.sharing)),
  food: (s) => s.food === true,
  ac: (s) => s.ac === true,
  furnished: (s, f) => s.furnished !== undefined && f.stayFurnished.includes(s.furnished),
  gender: (s, f) => f.stayGender.includes(s.gender ?? 'any'),
}

export type StayResult = {
  stay: Stay
  /** Straight-line km to the selected campus (or to the nearest visible campus). */
  distanceKm: number
  campusId: string
  failed: StayFilterId[]
}

/**
 * Filters stays. With a selected campus, distance is to that campus (the radius ring).
 * Without one, a stay counts if it is within the radius of any visible campus.
 * Returns only matching stays, nearest first.
 */
export function applyStayFilters(
  stays: readonly Stay[],
  f: StayFilterState,
  ctx: {
    selected: (LatLng & { id: string }) | null
    campuses: readonly (LatLng & { id: string })[]
  },
): StayResult[] {
  // Type always applies: its default (PG + flat + bungalow) already hides some types.
  // The other filters only run when changed from their "off" default.
  const active = ['types', ...changedStayFilters(f).filter((id) => id !== 'types')] as Exclude<
    StayFilterId,
    'distance'
  >[]
  const centres = ctx.selected ? [ctx.selected] : ctx.campuses
  const out: StayResult[] = []
  if (centres.length === 0) return out
  for (const stay of stays) {
    let best = Infinity
    let campusId = ''
    for (const c of centres) {
      const d = haversineKm(c, stay)
      if (d < best) {
        best = d
        campusId = c.id
      }
    }
    if (best > f.stayMaxDistanceKm) continue
    const failed = active.filter((id) => !PREDICATES[id](stay, f, best))
    if (failed.length === 0) out.push({ stay, distanceKm: best, campusId, failed })
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm)
}

/** Below this many matches near a campus, the UI suggests own listings and rental sites. */
export const FEW_STAYS = 5
