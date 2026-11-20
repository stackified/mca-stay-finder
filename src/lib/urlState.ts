/**
 * Filters, weights, score mode, sort and selection <-> URL query string (SPEC §5 "URL state").
 * Only values that differ from the defaults are written, so the default URL stays clean.
 * Parsing is defensive: unknown or invalid values are ignored.
 */
import {
  ALL_CONFIDENCE,
  ALL_DURATIONS,
  ALL_REGIONS,
  ALL_TYPES,
  DEFAULT_FILTERS,
  type FilterState,
} from './filters'
import { ALL_FURNISHED, ALL_GENDER, ALL_SHARING, ALL_SOURCES, ALL_STAY_TYPES } from './stays'
import type { SortState } from './presets'
import { DEFAULT_WEIGHTS, WEIGHT_KEYS, type ScoreMode, type Weights } from './scoring'

export type UrlState = {
  filters: FilterState
  weights: Weights
  scoreMode: ScoreMode
  sorting: SortState
  selectedCollegeId: string | null
}

export const DEFAULT_SCORE_MODE: ScoreMode = 'seed'

type NumKey = {
  [K in keyof FilterState]: FilterState[K] extends number | null ? K : never
}[keyof FilterState]
type BoolKey = {
  [K in keyof FilterState]: FilterState[K] extends boolean ? K : never
}[keyof FilterState]

const NUM: Record<string, NumKey> = {
  pmin: 'avgPackageMin',
  pmax: 'avgPackageMax',
  rate: 'placementRateMin',
  high: 'highestPackageMin',
  seats: 'seatsMin',
  fees: 'feesMax',
  aqi: 'annualAqiMax',
  poor: 'poorDaysMax',
  cost: 'costMax',
  living: 'livingMin',
  home: 'homeDistanceMaxKm',
  stay: 'stayMaxDistanceKm',
  smin: 'stayTravelMaxMin',
  bmin: 'stayBudgetMin',
  bmax: 'stayBudgetMax',
  rmin: 'stayRentMin',
  rmax: 'stayRentMax',
}
const BOOL: Record<string, BoolKey> = {
  sf: 'selfFinancingOnly',
  hostel: 'campusHostelOnly',
  excl: 'showExcluded',
  food: 'stayFoodOnly',
  ac: 'stayAcOnly',
}

/** List-valued filters: URL key, field, allowed values. */
type ListKey = {
  [K in keyof FilterState]: FilterState[K] extends string[] ? K : never
}[keyof FilterState]
const LISTS: [string, ListKey, readonly string[]][] = [
  ['type', 'types', ALL_TYPES],
  ['conf', 'placementConfidence', ALL_CONFIDENCE],
  ['dur', 'durations', ALL_DURATIONS],
  ['reg', 'regions', ALL_REGIONS],
  ['st', 'stayTypes', ALL_STAY_TYPES],
  ['share', 'staySharing', ALL_SHARING],
  ['furn', 'stayFurnished', ALL_FURNISHED],
  ['gender', 'stayGender', ALL_GENDER],
  ['src', 'staySources', ALL_SOURCES],
]

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

export function encodeUrlState(s: UrlState): string {
  const p = new URLSearchParams()
  const f = s.filters
  const d = DEFAULT_FILTERS

  const list = (key: string, v: readonly string[], def: readonly string[]) => {
    if (!sameList([...v].sort(), [...def].sort())) p.set(key, v.join(','))
  }
  list('inst', f.instituteIds, d.instituteIds)
  for (const [key, field] of LISTS) list(key, f[field], d[field])
  for (const [key, field] of Object.entries(NUM)) {
    const v = f[field]
    if (v !== d[field] && v !== null) p.set(key, String(v))
  }
  for (const [key, field] of Object.entries(BOOL))
    if (f[field] !== d[field]) p.set(key, f[field] ? '1' : '0')

  if (WEIGHT_KEYS.some((k) => s.weights[k] !== DEFAULT_WEIGHTS[k])) {
    p.set('w', WEIGHT_KEYS.map((k) => s.weights[k]).join(','))
  }
  if (s.scoreMode !== DEFAULT_SCORE_MODE) p.set('mode', s.scoreMode)
  if (s.sorting[0]) p.set('sort', `${s.sorting[0].id}.${s.sorting[0].desc ? 'desc' : 'asc'}`)
  if (s.selectedCollegeId) p.set('sel', s.selectedCollegeId)
  // Keep commas readable in the address bar.
  return p.toString().replace(/%2C/g, ',')
}

const parseList = <T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] | undefined => {
  if (raw === null) return undefined
  const items = raw.split(',').filter((x): x is T => (allowed as readonly string[]).includes(x))
  return items
}

const parseNum = (raw: string | null): number | undefined => {
  if (raw === null || raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function decodeUrlState(search: string): UrlState {
  const p = new URLSearchParams(search)
  const filters = structuredClone(DEFAULT_FILTERS) as FilterState

  const inst = p.get('inst')
  if (inst !== null) filters.instituteIds = inst.split(',').filter((x) => /^[a-z0-9-]+$/.test(x))
  for (const [key, field, allowed] of LISTS) {
    const v = parseList(p.get(key), allowed)
    if (v) (filters[field] as string[]) = v
  }

  for (const [key, field] of Object.entries(NUM)) {
    const n = parseNum(p.get(key))
    if (n !== undefined) (filters[field] as number | null) = n
  }
  for (const [key, field] of Object.entries(BOOL)) {
    const v = p.get(key)
    if (v === '1' || v === '0') filters[field] = v === '1'
  }

  let weights: Weights = { ...DEFAULT_WEIGHTS }
  const w = p.get('w')?.split(',').map(Number)
  if (
    w &&
    w.length === 4 &&
    w.every((x) => Number.isInteger(x) && x >= 0) &&
    w.reduce((a, b) => a + b, 0) === 100
  ) {
    weights = { placement: w[0]!, air: w[1]!, cost: w[2]!, living: w[3]! }
  }

  const mode = p.get('mode')
  const scoreMode: ScoreMode = mode === 'seed' || mode === 'computed' ? mode : DEFAULT_SCORE_MODE

  const sortRaw = p.get('sort')?.match(/^([a-zA-Z]+)\.(asc|desc)$/)
  const sorting: SortState = sortRaw ? [{ id: sortRaw[1]!, desc: sortRaw[2] === 'desc' }] : []

  const sel = p.get('sel')
  const selectedCollegeId = sel && /^[a-z0-9-]+$/.test(sel) ? sel : null

  return { filters, weights, scoreMode, sorting, selectedCollegeId }
}
