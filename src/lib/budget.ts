/**
 * Budget calculator (SPEC §6.5): stay option + duration (2 or 3 years) →
 * total cost including deposit, brokerage and one-time furnishing. Pure, unit-tested.
 */
import type { City, Range } from '@/types/domain'
import { addRanges, scaleRange } from './rangeMath'

export type StayOption =
  'pg_single' | 'pg_double' | 'pg_triple' | 'flat_1bhk' | 'flat_2bhk' | 'bungalow'

export const STAY_OPTION_LABEL: Record<StayOption, string> = {
  pg_single: 'PG — single',
  pg_double: 'PG — double sharing',
  pg_triple: 'PG — triple sharing',
  flat_1bhk: 'Flat — 1BHK',
  flat_2bhk: 'Flat — 2BHK',
  bungalow: 'Bungalow / house (3BHK)',
}

/** Default one-time furnishing estimate (₹). The owner can change it in the UI. */
export const DEFAULT_FURNISHING: Record<StayOption, number> = {
  pg_single: 0,
  pg_double: 0,
  pg_triple: 0,
  flat_1bhk: 40000,
  flat_2bhk: 60000,
  bungalow: 80000,
}

/**
 * "1–2 months" → 1–2, "~½ month" → 0.5, "~½–1 month" → 0.5–1, "3–5 months" → 3–5,
 * "Rare" → 0 (no brokerage). Unknown text → null.
 */
export function parseMonths(text: string): Range | null {
  const t = text.trim().toLowerCase().replace(/½/g, '.5').replace(/~/g, '')
  if (/^rare$|^none$|^no$/.test(t)) return { min: 0, max: 0 }
  const m = t.match(/^(\d*\.?\d+)\s*(?:[–-]\s*(\d*\.?\d+))?\s*months?$/)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] !== undefined ? Number(m[2]) : a
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

export type BudgetResult = {
  months: number
  monthlyAllIn: Range
  livingTotal: Range
  /** Usually refundable at the end. */
  deposit: Range
  brokerage: Range
  furnishing: number
  total: Range
  notes: string[]
}

export function computeBudget(
  city: City,
  option: StayOption,
  years: 2 | 3,
  furnishing: number = DEFAULT_FURNISHING[option],
): BudgetResult | null {
  const c = city.costs
  if (!c) return null
  const pgExtras = addRanges(c.pgExtras.acLaundry, c.pgExtras.transport, c.pgExtras.misc)
  const isPg = option.startsWith('pg_')
  const rent: Range = {
    pg_single: c.pgRentWithFood.single,
    pg_double: c.pgRentWithFood.double,
    pg_triple: c.pgRentWithFood.triple,
    flat_1bhk: c.rent.bhk1,
    flat_2bhk: c.rent.bhk2,
    bungalow: c.rent.house3bhk,
  }[option]
  const monthlyAllIn: Range = {
    pg_single: c.pgSingleAllIn,
    pg_double: c.pgDoubleAllIn,
    pg_triple: addRanges(c.pgRentWithFood.triple, pgExtras),
    flat_1bhk: c.flat1bhkAllIn,
    flat_2bhk: c.flat2bhkAllIn,
    bungalow: c.bungalowAllIn,
  }[option]

  const notes: string[] = []
  const depositMonths = parseMonths(isPg ? c.pgDepositMonths : c.depositMonths)
  const brokerageMonths = isPg ? { min: 0, max: 0 } : parseMonths(c.brokerage)
  if (!depositMonths)
    notes.push(
      `Deposit text "${isPg ? c.pgDepositMonths : c.depositMonths}" not understood; counted as 0.`,
    )
  if (!brokerageMonths) notes.push(`Brokerage text "${c.brokerage}" not understood; counted as 0.`)
  if (isPg) notes.push('PGs usually charge no brokerage.')

  const months = years * 12
  const livingTotal = scaleRange(monthlyAllIn, months)
  const deposit = scaleRange(rent, depositMonths ?? { min: 0, max: 0 })
  const brokerage = scaleRange(rent, brokerageMonths ?? { min: 0, max: 0 })
  const total = addRanges(livingTotal, deposit, brokerage, { min: furnishing, max: furnishing })
  notes.push('All figures are SPEC §11 estimates of 2026 market rates — verify locally.')
  return { months, monthlyAllIn, livingTotal, deposit, brokerage, furnishing, total, notes }
}
