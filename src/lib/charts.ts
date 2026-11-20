/**
 * Data for the Charts tab (SPEC §6.4). Pure, unit-tested. Ranges are shown as midpoints.
 */
import type { City, Range, SubScores } from '@/types/domain'

/** Chart series colours: distinct, ≥ 4.5:1 against white (checked in tests/a11y.test.ts). */
export const SERIES_COLORS = ['#2563eb', '#15803d', '#b45309', '#7c3aed', '#64748b'] as const

const mid = (r: Range) => (r.min + r.max) / 2
const shortCity = (name: string) => name.replace(/\s*\(.*\)\s*$/, '')

export type CostKind = 'pg_double' | 'flat_1bhk'

export type CostRow = {
  city: string
  cityId: string
  rent: number
  food: number
  utilities: number
  transport: number
  misc: number
  total: number
}

export const COST_PARTS = ['rent', 'food', 'utilities', 'transport', 'misc'] as const

/**
 * Monthly cost split per city (SPEC §11.3–11.5 midpoints).
 *   1BHK flat: rent + food + utilities (electricity, water/maintenance, Wi-Fi, maid/cook) + transport + misc
 *   PG double: rent includes food; utilities = AC power & laundry
 * Cities without cost data are left out. Sorted by total, cheapest first.
 */
export function costBreakdown(cities: readonly City[], kind: CostKind): CostRow[] {
  const rows: CostRow[] = []
  for (const c of cities) {
    const k = c.costs
    if (!k) continue
    const r = k.running
    const row =
      kind === 'flat_1bhk'
        ? {
            rent: mid(k.rent.bhk1),
            food: mid(r.food),
            utilities: mid(r.electricity) + mid(r.waterMaint) + mid(r.wifi) + mid(r.maidCook),
            transport: mid(r.transport),
            misc: mid(r.misc),
          }
        : {
            rent: mid(k.pgRentWithFood.double),
            food: 0,
            utilities: mid(k.pgExtras.acLaundry),
            transport: mid(k.pgExtras.transport),
            misc: mid(k.pgExtras.misc),
          }
    const total = row.rent + row.food + row.utilities + row.transport + row.misc
    rows.push({ city: shortCity(c.name), cityId: c.id, ...row, total })
  }
  return rows.sort((a, b) => a.total - b.total || a.city.localeCompare(b.city))
}

export type AqiRow = {
  city: string
  cityId: string
  annual: number | null
  live: number | null
  estimate: boolean
}

/** Annual (CPCB/estimate) and live (modelled 24-h) NAQI per city, cleanest annual first. */
export function aqiBars(
  cities: readonly City[],
  live?: Readonly<Record<string, { naqi: number | null }>> | null,
): AqiRow[] {
  return cities
    .filter((c) => c.annualAQI.value !== null || live?.[c.id]?.naqi != null)
    .map((c) => ({
      city: shortCity(c.name),
      cityId: c.id,
      annual: c.annualAQI.value === null ? null : Math.round(c.annualAQI.value),
      live: live?.[c.id]?.naqi ?? null,
      estimate: c.annualAQI.confidence === 'estimate',
    }))
    .sort((a, b) => (a.annual ?? Infinity) - (b.annual ?? Infinity) || a.city.localeCompare(b.city))
}

export const RADAR_AXES = [
  { key: 'placement', label: 'Placement' },
  { key: 'air', label: 'Air' },
  { key: 'cost', label: 'Cost' },
  { key: 'living', label: 'Living' },
] as const

/** Radar rows: one per axis, one column per series name (college). */
export function radarData(series: readonly { name: string; scores: SubScores | null }[]) {
  return RADAR_AXES.map((a) => {
    const row: Record<string, string | number> = { axis: a.label }
    for (const s of series) if (s.scores) row[s.name] = Math.round(s.scores[a.key] * 10) / 10
    return row
  })
}
