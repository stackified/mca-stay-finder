/**
 * Scoring (SPEC §10). Pure functions, unit-tested.
 *   finalScore = (wP*placement + wA*air + wC*cost + wL*living) / 100, sub-scores 0–10.
 */
import type { SubScores } from '@/types/domain'
import { cityCostIndex, type FilterOutcome } from './filters'

export type Weights = { placement: number; air: number; cost: number; living: number }
export type WeightKey = keyof Weights
export const WEIGHT_KEYS: readonly WeightKey[] = ['placement', 'air', 'cost', 'living']

export const DEFAULT_WEIGHTS: Readonly<Weights> = { placement: 40, air: 25, cost: 20, living: 15 }

/** `seed` = SPEC §11.1 values; `computed` = SPEC §10 formulas from the data. */
export type ScoreMode = 'computed' | 'seed'

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** `(wP*P + wA*A + wC*C + wL*L) / 100`. Weights must sum to 100. `null` scores → `null`. */
export function finalScore(scores: SubScores | null, w: Weights = DEFAULT_WEIGHTS): number | null {
  if (!scores) return null
  const total = w.placement + w.air + w.cost + w.living
  if (Math.abs(total - 100) > 1e-6) throw new RangeError(`Weights must sum to 100, got ${total}`)
  return (
    (w.placement * scores.placement +
      w.air * scores.air +
      w.cost * scores.cost +
      w.living * scores.living) /
    100
  )
}

/**
 * Sets one weight and spreads the rest over the others in proportion to their current
 * values (equally if they are all 0). Integers that always sum to 100 (SPEC §6.2 D).
 */
export function rebalanceWeights(w: Weights, key: WeightKey, value: number): Weights {
  const v = Math.round(clamp(value, 0, 100))
  const others = WEIGHT_KEYS.filter((k) => k !== key)
  const rest = 100 - v
  const sumOthers = others.reduce((s, k) => s + w[k], 0)
  const raw = others.map((k) => (sumOthers > 0 ? (w[k] / sumOthers) * rest : rest / others.length))
  // Largest-remainder rounding keeps the total exact.
  const floors = raw.map(Math.floor)
  let left = rest - floors.reduce((s, x) => s + x, 0)
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i]! += 1
    left -= 1
  }
  const next = { ...w, [key]: v }
  others.forEach((k, i) => (next[k] = floors[i]!))
  return next
}

/** SPEC §10 air score: NAQI 0 → 10, 200 → 0. */
export const airScore = (naqi: number | null): number | null =>
  naqi === null ? null : clamp(10 - naqi / 20, 0, 10)

/** Min-max to 0–10. If all values are equal, everyone gets 10. */
function minMax(values: readonly number[]): (v: number) => number {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return (v) => (hi === lo ? 10 : ((v - lo) / (hi - lo)) * 10)
}

/** SPEC §10 "no data" placement value. */
export const NO_DATA_PLACEMENT = 3.5

/**
 * Computes sub-scores for the given (visible, rankable) colleges.
 * Normalisation is across this set only, so scores change when filters change (SPEC §10).
 */
export function computeSubScores(
  rows: readonly Pick<FilterOutcome, 'college' | 'city'>[],
): Map<string, SubScores | null> {
  const pick = (f: (r: (typeof rows)[number]) => number | null | undefined) =>
    rows.map(f).filter((v): v is number => v != null)

  const avgN = minMax(pick((r) => r.college.avgPackageLPA.value))
  const rateN = minMax(pick((r) => r.college.placementRatePct?.value))
  const medN = minMax(pick((r) => r.college.medianPackageLPA?.value))
  const costN = minMax(pick((r) => cityCostIndex(r.city)))

  // Placement: avg 60% / rate 25% / median 15%, re-weighted over the parts that exist.
  const placementKnown = new Map<string, number>()
  for (const r of rows) {
    const c = r.college
    const avg = c.avgPackageLPA.value
    if (avg === null) continue
    const parts: [number, number][] = [[avgN(avg), 0.6]]
    if (c.placementRatePct?.value != null) parts.push([rateN(c.placementRatePct.value), 0.25])
    if (c.medianPackageLPA?.value != null) parts.push([medN(c.medianPackageLPA.value), 0.15])
    const wSum = parts.reduce((s, [, w]) => s + w, 0)
    placementKnown.set(c.id, parts.reduce((s, [v, w]) => s + v * w, 0) / wSum)
  }
  // "No data" gets 3.5, but never more than a college that has real data (decision log).
  const lowestKnown = placementKnown.size ? Math.min(...placementKnown.values()) : NO_DATA_PLACEMENT
  const noData = Math.min(NO_DATA_PLACEMENT, lowestKnown)

  const out = new Map<string, SubScores | null>()
  for (const r of rows) {
    const air = airScore(r.city?.annualAQI.value ?? null)
    const costIdx = cityCostIndex(r.city)
    const living = r.city?.livingScore ?? null
    if (air === null || costIdx === null || living === null) {
      out.set(r.college.id, null)
      continue
    }
    out.set(r.college.id, {
      placement: placementKnown.get(r.college.id) ?? noData,
      air,
      cost: 10 - costN(costIdx),
      living,
    })
  }
  return out
}

export type RankedCollege = FilterOutcome & {
  scores: SubScores | null
  final: number | null
  /** 1-based; `null` for excluded or unscored colleges. */
  rank: number | null
}

/**
 * Scores and ranks the visible colleges. Excluded colleges stay in the list (greyed)
 * but get no score and no rank. Order: final desc, then name; unscored last.
 */
export function rankColleges(
  outcomes: readonly FilterOutcome[],
  weights: Weights,
  mode: ScoreMode,
): RankedCollege[] {
  const visible = outcomes.filter((o) => o.visible)
  const rankable = visible.filter((o) => !o.excluded)
  const computed = mode === 'computed' ? computeSubScores(rankable) : null

  const scored = visible.map((o) => {
    const scores = o.excluded
      ? null
      : mode === 'seed'
        ? o.college.defaultScores
        : (computed!.get(o.college.id) ?? null)
    return { ...o, scores, final: finalScore(scores, weights), rank: null as number | null }
  })

  scored.sort((a, b) => {
    if (a.final === null && b.final === null) return a.college.name.localeCompare(b.college.name)
    if (a.final === null) return 1
    if (b.final === null) return -1
    return b.final - a.final || a.college.name.localeCompare(b.college.name)
  })
  let rank = 0
  for (const s of scored) if (s.final !== null) s.rank = ++rank
  return scored
}

export type ScoreBand = 'high' | 'mid' | 'low' | 'none'

/** Marker colour band (SPEC §6.3): green ≥ 8, yellow 6–8, red < 6. */
export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return 'none'
  if (score >= 8) return 'high'
  if (score >= 6) return 'mid'
  return 'low'
}

export const SCORE_BAND_STYLE: Record<ScoreBand, { label: string; color: string; text: string }> = {
  high: { label: '≥ 8', color: '#16a34a', text: '#ffffff' },
  mid: { label: '6 – 8', color: '#eab308', text: '#1c1917' },
  low: { label: '< 6', color: '#dc2626', text: '#ffffff' },
  none: { label: 'No score', color: '#9ca3af', text: '#1c1917' },
}

/** One decimal, as SPEC shows scores. */
export const formatScore = (s: number | null): string => (s === null ? '–' : s.toFixed(1))
