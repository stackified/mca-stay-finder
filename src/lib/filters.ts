/**
 * College + city filters (SPEC §6.2 A and B). Pure functions, unit-tested.
 *
 * Rules:
 * - All active filters combine with AND.
 * - A filter at its default value is "off" and removes nothing.
 * - When a filter is on, a missing value fails it — except where `unknownPasses` is set
 *   (fees: SPEC says "unknown badge"; poor days: data exists for only half the cities).
 * - Colleges in excluded cities are hidden unless `showExcluded`; then they are shown
 *   greyed and never ranked (SPEC §13).
 */
import type { City, College, CollegeType, Confidence, Region } from '@/types/domain'
import { DEFAULT_STAY_FILTERS, type StayFilterState } from './stays'

export const ALL_TYPES: CollegeType[] = ['NIT', 'VIT', 'IIIT']
export const ALL_CONFIDENCE: Confidence[] = ['official', 'aggregator', 'estimate', 'none']
export const ALL_DURATIONS = ['2', '3', 'unknown'] as const
export type DurationKey = (typeof ALL_DURATIONS)[number]
export const ALL_REGIONS: Region[] = ['North', 'Central', 'East', 'NorthEast', 'South', 'West']

export type FilterState = {
  // A. College
  types: CollegeType[]
  /** Empty = all institutes. */
  instituteIds: string[]
  avgPackageMin: number | null
  avgPackageMax: number | null
  placementRateMin: number | null
  highestPackageMin: number | null
  placementConfidence: Confidence[]
  durations: DurationKey[]
  seatsMin: number | null
  selfFinancingOnly: boolean
  campusHostelOnly: boolean
  feesMax: number | null
  // B. City
  annualAqiMax: number | null
  /** Live (modelled, 24-h mean) NAQI from Open-Meteo, Phase 6. */
  liveAqiMax: number | null
  poorDaysMax: number | null
  /** Max PG-double all-in midpoint, ₹/month (the app's cost-of-living index). */
  costMax: number | null
  livingMin: number | null
  regions: Region[]
  homeDistanceMaxKm: number | null
  showExcluded: boolean
} & StayFilterState // C. Stay filters (lib/stays.ts)

/** Owner defaults (SPEC §2, §6.2). */
export const DEFAULT_FILTERS: Readonly<FilterState> = {
  types: ['NIT', 'VIT'],
  instituteIds: [],
  avgPackageMin: null,
  avgPackageMax: null,
  placementRateMin: null,
  highestPackageMin: null,
  placementConfidence: [...ALL_CONFIDENCE],
  durations: [...ALL_DURATIONS],
  seatsMin: null,
  selfFinancingOnly: false,
  campusHostelOnly: false,
  feesMax: null,
  annualAqiMax: null,
  liveAqiMax: null,
  poorDaysMax: null,
  costMax: null,
  livingMin: null,
  regions: [...ALL_REGIONS],
  homeDistanceMaxKm: null,
  showExcluded: false,
  ...DEFAULT_STAY_FILTERS,
}

export const rangeMid = (r: { min: number; max: number }) => (r.min + r.max) / 2

/** Value the cost filter and cost score use for a city. */
export const cityCostIndex = (city: City | undefined): number | null =>
  city?.costs ? rangeMid(city.costs.pgDoubleAllIn) : null

export const durationKey = (c: College): DurationKey =>
  c.durationYears.value === null ? 'unknown' : (String(c.durationYears.value) as DurationKey)

export type FilterId =
  | 'types'
  | 'instituteIds'
  | 'avgPackage'
  | 'placementRateMin'
  | 'highestPackageMin'
  | 'placementConfidence'
  | 'durations'
  | 'seatsMin'
  | 'selfFinancingOnly'
  | 'campusHostelOnly'
  | 'feesMax'
  | 'annualAqiMax'
  | 'liveAqiMax'
  | 'poorDaysMax'
  | 'costMax'
  | 'livingMin'
  | 'regions'
  | 'homeDistanceMaxKm'

type FilterDef = {
  id: FilterId
  label: string
  isActive: (f: FilterState) => boolean
  /** True = the college passes. Only called when the filter is active. */
  test: (c: College, city: City | undefined, f: FilterState, ctx: FilterContext) => boolean
  /** Turns this one filter off. */
  relax: (f: FilterState) => Partial<FilterState>
  /**
   * True when the owner changed this filter from its default. Defaults to `isActive`.
   * Differs only for `types`: IIIT is off by default (an active rule, but not a change).
   */
  isChanged?: (f: FilterState) => boolean
}

const sameSet = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

const atLeast = (v: number | null | undefined, min: number) => v != null && v >= min
const atMost = (v: number | null | undefined, max: number) => v != null && v <= max

export const FILTER_DEFS: readonly FilterDef[] = [
  {
    id: 'types',
    label: 'Institute type',
    isActive: (f) => !sameSet(f.types, ALL_TYPES),
    test: (c, _city, f) => f.types.includes(c.type),
    relax: () => ({ types: [...ALL_TYPES] }),
    isChanged: (f) => !sameSet(f.types, DEFAULT_FILTERS.types),
  },
  {
    id: 'instituteIds',
    label: 'Specific institutes',
    isActive: (f) => f.instituteIds.length > 0,
    test: (c, _city, f) => f.instituteIds.includes(c.id),
    relax: () => ({ instituteIds: [] }),
  },
  {
    id: 'avgPackage',
    label: 'MCA average package',
    isActive: (f) => f.avgPackageMin !== null || f.avgPackageMax !== null,
    test: (c, _city, f) => {
      const v = c.avgPackageLPA.value
      if (v === null) return false
      return (
        (f.avgPackageMin === null || v >= f.avgPackageMin) &&
        (f.avgPackageMax === null || v <= f.avgPackageMax)
      )
    },
    relax: () => ({ avgPackageMin: null, avgPackageMax: null }),
  },
  {
    id: 'placementRateMin',
    label: 'Placement rate',
    isActive: (f) => f.placementRateMin !== null,
    test: (c, _city, f) => atLeast(c.placementRatePct?.value, f.placementRateMin!),
    relax: () => ({ placementRateMin: null }),
  },
  {
    id: 'highestPackageMin',
    label: 'Highest package',
    isActive: (f) => f.highestPackageMin !== null,
    test: (c, _city, f) => atLeast(c.highestPackageLPA?.value, f.highestPackageMin!),
    relax: () => ({ highestPackageMin: null }),
  },
  {
    id: 'placementConfidence',
    label: 'Placement data confidence',
    isActive: (f) => !sameSet(f.placementConfidence, ALL_CONFIDENCE),
    test: (c, _city, f) => f.placementConfidence.includes(c.avgPackageLPA.confidence),
    relax: () => ({ placementConfidence: [...ALL_CONFIDENCE] }),
  },
  {
    id: 'durations',
    label: 'MCA duration',
    isActive: (f) => !sameSet(f.durations, ALL_DURATIONS),
    test: (c, _city, f) => f.durations.includes(durationKey(c)),
    relax: () => ({ durations: [...ALL_DURATIONS] }),
  },
  {
    id: 'seatsMin',
    label: 'Seats',
    isActive: (f) => f.seatsMin !== null,
    test: (c, _city, f) => atLeast(c.seats.value, f.seatsMin!),
    relax: () => ({ seatsMin: null }),
  },
  {
    id: 'selfFinancingOnly',
    label: 'Self-financing seats',
    isActive: (f) => f.selfFinancingOnly,
    test: (c) => (c.selfFinancingSeats?.value ?? 0) > 0,
    relax: () => ({ selfFinancingOnly: false }),
  },
  {
    id: 'campusHostelOnly',
    label: 'Campus hostel',
    isActive: (f) => f.campusHostelOnly,
    test: (c) => c.campusHostel,
    relax: () => ({ campusHostelOnly: false }),
  },
  {
    id: 'feesMax',
    label: 'Program fees',
    isActive: (f) => f.feesMax !== null,
    // Unknown fees pass (shown with an "unknown" badge, SPEC §6.2).
    test: (c, _city, f) => c.totalFeesINR?.value == null || c.totalFeesINR.value <= f.feesMax!,
    relax: () => ({ feesMax: null }),
  },
  {
    id: 'annualAqiMax',
    label: 'Annual AQI',
    isActive: (f) => f.annualAqiMax !== null,
    test: (_c, city, f) => atMost(city?.annualAQI.value, f.annualAqiMax!),
    relax: () => ({ annualAqiMax: null }),
  },
  {
    id: 'liveAqiMax',
    label: 'Live AQI (modelled)',
    isActive: (f) => f.liveAqiMax !== null,
    // No live value (offline, API down) fails, like any other active filter.
    test: (_c, city, f, ctx) => !!city && atMost(ctx.liveNaqi?.(city.id), f.liveAqiMax!),
    relax: () => ({ liveAqiMax: null }),
  },
  {
    id: 'poorDaysMax',
    label: '"Poor or worse" days',
    isActive: (f) => f.poorDaysMax !== null,
    // Unknown passes: only 8 of 16 cities have this figure.
    test: (_c, city, f) =>
      city?.poorDaysPerYear?.value == null || city.poorDaysPerYear.value <= f.poorDaysMax!,
    relax: () => ({ poorDaysMax: null }),
  },
  {
    id: 'costMax',
    label: 'Cost of living (PG double all-in)',
    isActive: (f) => f.costMax !== null,
    test: (_c, city, f) => atMost(cityCostIndex(city), f.costMax!),
    relax: () => ({ costMax: null }),
  },
  {
    id: 'livingMin',
    label: 'Standard of living',
    isActive: (f) => f.livingMin !== null,
    test: (_c, city, f) => atLeast(city?.livingScore, f.livingMin!),
    relax: () => ({ livingMin: null }),
  },
  {
    id: 'regions',
    label: 'Region',
    isActive: (f) => !sameSet(f.regions, ALL_REGIONS),
    test: (_c, city, f) => !!city && f.regions.includes(city.region),
    relax: () => ({ regions: [...ALL_REGIONS] }),
  },
  {
    id: 'homeDistanceMaxKm',
    label: 'Distance from Surat',
    isActive: (f) => f.homeDistanceMaxKm !== null,
    test: (_c, city, f) => atMost(city?.distanceFromHomeKm, f.homeDistanceMaxKm!),
    relax: () => ({ homeDistanceMaxKm: null }),
  },
]

/** Filters the owner changed from the defaults (for badges and "Reset all"). */
export const changedFilterIds = (f: FilterState): FilterId[] =>
  FILTER_DEFS.filter((d) => (d.isChanged ? d.isChanged(f) : d.isActive(f))).map((d) => d.id)

export type FilterOutcome = {
  college: College
  city: City | undefined
  /** City is on the owner's excluded list. */
  excluded: boolean
  /** Active filters this college fails. */
  failed: FilterId[]
  /** Shown on the map / in the table (may be greyed if excluded). */
  visible: boolean
}

/** Data that is not part of the seed (Phase 6 live AQI). */
export type FilterContext = {
  /** Live NAQI for a city, or null/undefined when not available. */
  liveNaqi?: (cityId: string) => number | null | undefined
}

export function applyFilters(
  colleges: readonly College[],
  cities: readonly City[],
  f: FilterState,
  ctx: FilterContext = {},
): FilterOutcome[] {
  const cityById = new Map(cities.map((c) => [c.id, c]))
  const active = FILTER_DEFS.filter((d) => d.isActive(f))
  return colleges.map((college) => {
    const city = cityById.get(college.cityId)
    const excluded = !!city?.excluded
    const failed = active.filter((d) => !d.test(college, city, f, ctx)).map((d) => d.id)
    return {
      college,
      city,
      excluded,
      failed,
      visible: failed.length === 0 && (!excluded || f.showExcluded),
    }
  })
}

export type FilterImpact = {
  id: FilterId
  label: string
  removed: number
  relax: Partial<FilterState>
}

/**
 * For the empty state: for each active filter, how many colleges come back if only that
 * filter is relaxed (they fail it and nothing else). Excluded cities are ignored.
 * If no single filter brings anything back (several filters block together), falls back
 * to how many colleges each filter removes. Largest first.
 */
export function filterImpact(outcomes: readonly FilterOutcome[], f: FilterState): FilterImpact[] {
  const live = outcomes.filter((o) => !o.excluded)
  const score = (onlyThis: boolean) =>
    FILTER_DEFS.filter((d) => d.isActive(f))
      .map((d) => ({
        id: d.id,
        label: d.label,
        removed: live.filter((o) =>
          onlyThis ? o.failed.length === 1 && o.failed[0] === d.id : o.failed.includes(d.id),
        ).length,
        relax: d.relax(f),
      }))
      .filter((x) => x.removed > 0)
      .sort((a, b) => b.removed - a.removed)
  const alone = score(true)
  return alone.length > 0 ? alone : score(false)
}
