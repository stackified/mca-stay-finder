import type { Range } from '../../src/types/domain.ts'

/** Range in thousands of INR → INR. `k(7, 11)` = ₹7,000–₹11,000. */
export const k = (min: number, max: number): Range => ({
  min: Math.round(min * 1000),
  max: Math.round(max * 1000),
})

/** Range in INR. */
export const inr = (min: number, max: number): Range => ({ min, max })

export const addRanges = (...rs: Range[]): Range => ({
  min: rs.reduce((s, r) => s + r.min, 0),
  max: rs.reduce((s, r) => s + r.max, 0),
})

/** Midpoint of a range given as text in SPEC, for example "~60–75" → 67.5. */
export const mid = (min: number, max: number): number => (min + max) / 2

export const SOURCES = {
  seats: 'NIMCET 2026 official seat matrix (nimcet.admissions.nic.in)',
  placements:
    'Aggregators: Shiksha, Collegedunia, Careers360, Tarkashastra, Maarula — replace with official NIRF/college reports when available',
  aqiCpcb: 'CPCB daily AQI bulletins 2025, aggregated (via helloboon.com/air-quality)',
  smartAir: 'Smart Air 2025 least-polluted-cities list',
  vit: 'VITMEE (MCA) 2026 information brochure (vit.ac.in)',
  costs:
    'Estimates of typical 2026 market rates near campus (SPEC §11.3–11.6) — verify on rental sites',
  chatResearch: 'Research done in chat, Nov 2026 (SPEC §11)',
  coords: 'Approximate coordinates — verify with geocode.ts (Nominatim)',
} as const

export const AS_OF = {
  aqi: '2025',
  costs: '2026-11',
  seats: '2026',
} as const
