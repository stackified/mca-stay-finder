/**
 * Scoring (SPEC §10). Phase 2 has only the seed-score part.
 * Phase 3 adds computed sub-scores, weight rebalancing and ranking.
 */
import type { SubScores } from '@/types/domain'

export type Weights = { placement: number; air: number; cost: number; living: number }

export const DEFAULT_WEIGHTS: Readonly<Weights> = { placement: 40, air: 25, cost: 20, living: 15 }

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
