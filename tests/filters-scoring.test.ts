import { buildSeed } from '../scripts/seed.ts'
import {
  ALL_REGIONS,
  DEFAULT_FILTERS,
  applyFilters,
  filterImpact,
  type FilterState,
} from '@/lib/filters'
import { PRESETS } from '@/lib/presets'
import {
  DEFAULT_WEIGHTS,
  NO_DATA_PLACEMENT,
  WEIGHT_KEYS,
  airScore,
  computeSubScores,
  rankColleges,
  rebalanceWeights,
  type Weights,
} from '@/lib/scoring'
import { decodeUrlState, encodeUrlState, type UrlState } from '@/lib/urlState'

const seed = buildSeed('2026-11-20')
const cities = seed['cities.json'].data
const colleges = seed['colleges.json'].data

const f = (patch: Partial<FilterState> = {}): FilterState => ({
  ...(structuredClone(DEFAULT_FILTERS) as FilterState),
  ...patch,
})
const visibleIds = (filters: FilterState) =>
  applyFilters(colleges, cities, filters)
    .filter((o) => o.visible)
    .map((o) => o.college.id)
    .sort()
const ranked = (
  filters = f(),
  weights: Weights = DEFAULT_WEIGHTS,
  mode: 'seed' | 'computed' = 'computed',
) => rankColleges(applyFilters(colleges, cities, filters), weights, mode)

describe('defaults (SPEC §2)', () => {
  it('show the 11 NITs and 3 VITs; hide IIIT and the excluded city', () => {
    const ids = visibleIds(f())
    expect(ids).toHaveLength(14)
    expect(ids.some((id) => id.startsWith('iiit'))).toBe(false)
  })
})

describe('SPEC §13 item 1: annual AQI ≤ 100', () => {
  it('hides Delhi, Patna, Bhopal, Jamshedpur and Kurukshetra campuses', () => {
    const ids = visibleIds(f({ annualAqiMax: 100 }))
    for (const gone of [
      'nit-delhi',
      'nit-patna',
      'manit-bhopal',
      'nit-jamshedpur',
      'nit-kurukshetra',
    ]) {
      expect(ids).not.toContain(gone)
    }
    expect(ids).toContain('nit-warangal')
    expect(ids).toContain('nit-trichy')
    expect(ids).toContain('mnnit-allahabad') // Prayagraj 85
  })

  it('also removes them from the ranking', () => {
    const r = ranked(f({ annualAqiMax: 100 }))
    expect(r.map((x) => x.college.id)).not.toContain('nit-delhi')
  })
})

describe('SPEC §13 item 5: excluded cities', () => {
  const withIIIT = { types: ['NIT', 'VIT', 'IIIT'] as FilterState['types'] }

  it('never appear unless "Show excluded" is on', () => {
    expect(visibleIds(f(withIIIT))).not.toContain('iiit-vadodara-gandhinagar')
  })

  it('appear greyed (excluded) and are never ranked when shown', () => {
    const r = ranked(f({ ...withIIIT, showExcluded: true }))
    const g = r.find((x) => x.college.id === 'iiit-vadodara-gandhinagar')!
    expect(g.excluded).toBe(true)
    expect(g.final).toBeNull()
    expect(g.rank).toBeNull()
  })

  it('still obey other filters', () => {
    expect(visibleIds(f({ showExcluded: true }))).not.toContain('iiit-vadodara-gandhinagar') // IIIT off
  })
})

describe('filters combine with AND', () => {
  it('type + AQI + package', () => {
    const ids = visibleIds(f({ types: ['NIT'], annualAqiMax: 100, avgPackageMin: 10 }))
    expect(ids).toEqual(['mnnit-allahabad', 'nit-trichy', 'nit-warangal'])
  })

  it('an active numeric filter drops colleges with no value', () => {
    expect(visibleIds(f({ avgPackageMin: 0 }))).not.toContain('nit-patna')
  })

  it('unknown fees pass the fees filter', () => {
    const ids = visibleIds(f({ feesMax: 100000 }))
    expect(ids).not.toContain('vit-vellore') // ₹2.77 L > 1 L
    expect(ids).toContain('vit-chennai') // unknown
  })

  it('region, duration, hostel and self-financing filters', () => {
    expect(visibleIds(f({ regions: ['South'] }))).toEqual([
      'nit-trichy',
      'nit-warangal',
      'vit-chennai',
      'vit-vellore',
    ])
    expect(visibleIds(f({ durations: ['2'] }))).toEqual([
      'nit-delhi',
      'nit-raipur',
      'vit-bhopal',
      'vit-chennai',
      'vit-vellore',
    ])
    expect(visibleIds(f({ selfFinancingOnly: true }))).toEqual([
      'nit-delhi',
      'nit-kurukshetra',
      'nit-patna',
    ])
    expect(visibleIds(f({ campusHostelOnly: true }))).toHaveLength(14)
  })

  it('reports which filter removes the most (empty state)', () => {
    const filters = f({ annualAqiMax: 20, types: ['NIT'] })
    const impact = filterImpact(applyFilters(colleges, cities, filters), filters)
    expect(impact[0]?.id).toBe('annualAqiMax')
    expect(impact[0]?.relax).toEqual({ annualAqiMax: null })
    // AQI ≤ 20 keeps only NIT Meghalaya (Shillong 14). Relaxing AQI alone brings back the
    // other 10 NITs; VIT/IIIT also fail the type filter, so they do not count.
    expect(impact[0]?.removed).toBe(10)
  })
})

describe('rebalanceWeights (SPEC §6.2 D)', () => {
  it.each([0, 1, 33, 50, 60, 99, 100, 140, -5])('always sums to 100 (placement = %d)', (v) => {
    const w = rebalanceWeights(DEFAULT_WEIGHTS, 'placement', v)
    expect(WEIGHT_KEYS.reduce((s, k) => s + w[k], 0)).toBe(100)
    expect(WEIGHT_KEYS.every((k) => Number.isInteger(w[k]) && w[k] >= 0)).toBe(true)
  })

  it('keeps the ratio of the other weights', () => {
    // 25:20:15 over 40 remaining → 16.67 : 13.33 : 10
    expect(rebalanceWeights(DEFAULT_WEIGHTS, 'placement', 60)).toEqual({
      placement: 60,
      air: 17,
      cost: 13,
      living: 10,
    })
  })

  it('splits equally when the others are all 0', () => {
    const w = rebalanceWeights({ placement: 100, air: 0, cost: 0, living: 0 }, 'placement', 70)
    expect(w).toEqual({ placement: 70, air: 10, cost: 10, living: 10 })
  })
})

describe('computed sub-scores (SPEC §10)', () => {
  it('air: NAQI 0 → 10, 200 → 0, clamped', () => {
    expect(airScore(0)).toBe(10)
    expect(airScore(100)).toBe(5)
    expect(airScore(200)).toBe(0)
    expect(airScore(400)).toBe(0)
    expect(airScore(null)).toBeNull()
  })

  const rows = applyFilters(colleges, cities, f()).filter((o) => o.visible && !o.excluded)
  const s = computeSubScores(rows)

  it('cost: cheapest PG-double city = 10, dearest = 0', () => {
    expect(s.get('vit-vellore')?.cost).toBeCloseTo(10) // ₹8k–12.5k
    expect(s.get('vit-chennai')?.cost).toBeCloseTo(0) // ₹11.5k–17.5k
  })

  it('placement: best avg package = 10; no data ≤ 3.5 and never above real data', () => {
    expect(s.get('mnnit-allahabad')?.placement).toBeCloseTo(10) // 15.49 LPA, no rate/median
    const noData = s.get('nit-patna')!.placement
    expect(noData).toBeLessThanOrEqual(NO_DATA_PLACEMENT)
    const knownMin = Math.min(
      ...rows
        .filter((r) => r.college.avgPackageLPA.value !== null)
        .map((r) => s.get(r.college.id)!.placement),
    )
    expect(noData).toBeLessThanOrEqual(knownMin)
  })

  it('living comes from the city seed', () => {
    expect(s.get('manit-bhopal')?.living).toBe(8.5)
  })

  it('all sub-scores stay within 0–10', () => {
    for (const v of s.values()) {
      for (const k of WEIGHT_KEYS) expect(v![k]).toBeGreaterThanOrEqual(0)
      for (const k of WEIGHT_KEYS) expect(v![k]).toBeLessThanOrEqual(10)
    }
  })
})

describe('ranking', () => {
  it('seed mode reproduces the SPEC order at the top', () => {
    const top = ranked(f(), DEFAULT_WEIGHTS, 'seed')
      .slice(0, 3)
      .map((r) => r.college.id)
    expect(top).toEqual(['nit-warangal', 'nit-trichy', 'mnnit-allahabad'])
  })

  it('ranks are 1..n with no gaps, unscored last', () => {
    const r = ranked(f({ types: ['NIT', 'VIT', 'IIIT'] }))
    const ranks = r.filter((x) => x.rank !== null).map((x) => x.rank)
    expect(ranks).toEqual(ranks.map((_, i) => i + 1))
    // IIIT Vadodara (Diu) has no air/cost data, so it is unscored.
    const firstNull = r.findIndex((x) => x.final === null)
    expect(firstNull).toBeGreaterThan(0)
    expect(r.slice(firstNull).every((x) => x.final === null)).toBe(true)
    expect(r.slice(firstNull).map((x) => x.college.id)).toContain('iiit-vadodara-diu')
  })

  it('SPEC §13 item 4: moving the placement weight reorders the ranking', () => {
    const order = (w: Weights) => ranked(f(), w, 'seed').map((r) => r.college.id)
    const noPlacement = order(rebalanceWeights(DEFAULT_WEIGHTS, 'placement', 0))
    const placementHeavy = order(rebalanceWeights(DEFAULT_WEIGHTS, 'placement', 100))
    expect(noPlacement).not.toEqual(placementHeavy)
    expect(placementHeavy[0]).toMatch(/nit-warangal|mnnit-allahabad/)
    // Placement only: MNNIT and Warangal share 9.5, name breaks the tie.
    expect(placementHeavy.slice(0, 2)).toEqual(['mnnit-allahabad', 'nit-warangal'])
    expect(order(rebalanceWeights(DEFAULT_WEIGHTS, 'air', 100))[0]).toBe('nit-meghalaya') // air 10
  })

  it('breaks ties by name', () => {
    const same = { placement: 5, air: 5, cost: 5, living: 5 }
    const a = colleges.find((c) => c.id === 'nit-raipur')!
    const b = colleges.find((c) => c.id === 'nit-agartala')!
    const outcomes = [b, a].map((college) => ({
      college: { ...college, defaultScores: same },
      city: undefined,
      excluded: false,
      failed: [],
      visible: true,
    }))
    expect(rankColleges(outcomes, DEFAULT_WEIGHTS, 'seed').map((r) => r.college.id)).toEqual([
      'nit-agartala',
      'nit-raipur',
    ])
  })
})

describe('URL state', () => {
  const defaults: UrlState = {
    filters: f(),
    weights: { ...DEFAULT_WEIGHTS },
    scoreMode: 'seed',
    sorting: [],
    selectedCollegeId: null,
  }

  it('defaults encode to an empty query', () => {
    expect(encodeUrlState(defaults)).toBe('')
  })

  it('round-trips a non-default state', () => {
    const s: UrlState = {
      filters: f({
        types: ['NIT'],
        instituteIds: ['nit-warangal', 'nit-trichy'],
        annualAqiMax: 100,
        avgPackageMin: 9,
        regions: ALL_REGIONS.filter((r) => r !== 'North'),
        showExcluded: true,
        stayMaxDistanceKm: 2,
        durations: ['3'],
        placementConfidence: ['official', 'aggregator'],
      }),
      weights: { placement: 60, air: 15, cost: 15, living: 10 },
      scoreMode: 'computed',
      sorting: [{ id: 'pgDouble', desc: false }],
      selectedCollegeId: 'nit-warangal',
    }
    const q = encodeUrlState(s)
    expect(q).toContain('aqi=100')
    expect(decodeUrlState(q)).toEqual(s)
  })

  it('ignores invalid values', () => {
    const d = decodeUrlState('?aqi=abc&w=50,50,50,50&type=FOO,NIT&mode=x&sel=<script>')
    expect(d.filters.annualAqiMax).toBeNull()
    expect(d.weights).toEqual(DEFAULT_WEIGHTS)
    expect(d.filters.types).toEqual(['NIT'])
    expect(d.scoreMode).toBe('seed')
    expect(d.selectedCollegeId).toBeNull()
  })
})

describe('presets (SPEC §6.2 E)', () => {
  const get = (id: string) => PRESETS.find((p) => p.id === id)!.build()

  it('placement first = NIT only + 60/15/15/10', () => {
    const p = get('placement-first')
    expect(p.filters.types).toEqual(['NIT'])
    expect(p.weights).toEqual({ placement: 60, air: 15, cost: 15, living: 10 })
  })

  it('clean air first = AQI ≤ 100 + 30/45/15/10', () => {
    const p = get('clean-air')
    expect(p.filters.annualAqiMax).toBe(100)
    expect(p.weights).toEqual({ placement: 30, air: 45, cost: 15, living: 10 })
  })

  it('every preset has weights summing to 100 and does not mutate defaults', () => {
    for (const preset of PRESETS) {
      const p = preset.build()
      expect(WEIGHT_KEYS.reduce((s, k) => s + p.weights[k], 0)).toBe(100)
    }
    expect(DEFAULT_FILTERS.types).toEqual(['NIT', 'VIT'])
  })
})
