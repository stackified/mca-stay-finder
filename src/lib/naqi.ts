/**
 * Indian National AQI (NAQI) from PM2.5 and PM10 (SPEC §9).
 * Sub-index = linear interpolation inside the band. NAQI = max of the sub-indices.
 * Pure functions, no imports: the Node data scripts load this file directly.
 */

export type NaqiBand = 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe'

type Breakpoint = { cHi: number; iHi: number }

/**
 * Band upper edges. Each band starts where the previous one ends, so the curve is continuous.
 * The Severe band has no upper concentration in SPEC; 380 (PM2.5) and 510 (PM10) are assumed
 * so the curve reaches 500. Values above that clamp to 500.
 */
const PM25: readonly Breakpoint[] = [
  { cHi: 30, iHi: 50 },
  { cHi: 60, iHi: 100 },
  { cHi: 90, iHi: 200 },
  { cHi: 120, iHi: 300 },
  { cHi: 250, iHi: 400 },
  { cHi: 380, iHi: 500 },
]

const PM10: readonly Breakpoint[] = [
  { cHi: 50, iHi: 50 },
  { cHi: 100, iHi: 100 },
  { cHi: 250, iHi: 200 },
  { cHi: 350, iHi: 300 },
  { cHi: 430, iHi: 400 },
  { cHi: 510, iHi: 500 },
]

function subIndex(c: number, table: readonly Breakpoint[]): number {
  if (!Number.isFinite(c) || c < 0) throw new RangeError(`Invalid concentration: ${c}`)
  let cLo = 0
  let iLo = 0
  for (const { cHi, iHi } of table) {
    if (c <= cHi) return iLo + ((iHi - iLo) * (c - cLo)) / (cHi - cLo)
    cLo = cHi
    iLo = iHi
  }
  return 500
}

/** PM2.5 sub-index (µg/m³, 24-h average). */
export const pm25SubIndex = (pm25: number): number => subIndex(pm25, PM25)

/** PM10 sub-index (µg/m³, 24-h average). */
export const pm10SubIndex = (pm10: number): number => subIndex(pm10, PM10)

export type NaqiResult = { aqi: number; band: NaqiBand; dominant: 'pm25' | 'pm10' }

/**
 * NAQI from whichever PM values are known. Returns `null` when both are missing.
 * The result is rounded to a whole number, as CPCB reports it.
 */
export function pmToNaqi(pm25?: number | null, pm10?: number | null): NaqiResult | null {
  const s25 = pm25 == null ? null : pm25SubIndex(pm25)
  const s10 = pm10 == null ? null : pm10SubIndex(pm10)
  if (s25 === null && s10 === null) return null
  const dominant = s10 === null || (s25 !== null && s25 >= s10) ? 'pm25' : 'pm10'
  const aqi = Math.round(dominant === 'pm25' ? (s25 as number) : (s10 as number))
  return { aqi, band: naqiBand(aqi), dominant }
}

/** Band name for a NAQI value. */
export function naqiBand(aqi: number): NaqiBand {
  if (aqi <= 50) return 'Good'
  if (aqi <= 100) return 'Satisfactory'
  if (aqi <= 200) return 'Moderate'
  if (aqi <= 300) return 'Poor'
  if (aqi <= 400) return 'Very Poor'
  return 'Severe'
}
