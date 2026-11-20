/**
 * Live air quality + weather from Open-Meteo (SPEC §9), free and keyless.
 * Values are CAMS model output ("modelled"), not CPCB station readings.
 *
 * Indian NAQI bands are defined on 24-hour averages, so the live NAQI uses the mean of the
 * last 24 hourly PM values up to now (needs ≥ 18 of 24 hours), not the single current hour.
 *
 * Pure functions and a zod schema only: used by the browser and by scripts/fetch-aqi.ts.
 */
import { z } from 'zod'
import { pmToNaqi } from './naqi.ts'

export const AIR_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality'
export const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
export const LIVE_TTL_MS = 60 * 60 * 1000 // SPEC: 1-hour cache

export type Point = { id: string; lat: number; lng: number }

const coords = (points: readonly Point[]) => ({
  latitude: points.map((p) => p.lat.toFixed(4)).join(','),
  longitude: points.map((p) => p.lng.toFixed(4)).join(','),
})

export const airUrl = (points: readonly Point[]) =>
  `${AIR_ENDPOINT}?${new URLSearchParams({
    ...coords(points),
    current: 'pm2_5,pm10,us_aqi',
    hourly: 'pm2_5,pm10',
    past_days: '1',
    forecast_days: '1',
    timezone: 'auto',
  })}`

export const weatherUrl = (points: readonly Point[]) =>
  `${WEATHER_ENDPOINT}?${new URLSearchParams({
    ...coords(points),
    current: 'temperature_2m,relative_humidity_2m',
    daily: 'temperature_2m_max',
    forecast_days: '1',
    timezone: 'auto',
  })}`

// ---------- Open-Meteo response subsets ----------

type Num = number | null
export type OmAir = {
  current?: { time: string; pm2_5?: Num; pm10?: Num; us_aqi?: Num }
  hourly?: { time: string[]; pm2_5?: Num[]; pm10?: Num[] }
}
export type OmWeather = {
  current?: { time: string; temperature_2m?: Num; relative_humidity_2m?: Num }
  daily?: { time: string[]; temperature_2m_max?: Num[] }
}

/** Mean of the last 24 hourly values at or before `nowTime` (same local ISO format). */
export function mean24(
  times: readonly string[],
  values: readonly Num[] | undefined,
  nowTime: string,
): {
  mean: number | null
  hours: number
} {
  if (!values) return { mean: null, hours: 0 }
  const upTo = times.reduce((last, t, i) => (t <= nowTime ? i : last), -1)
  const window = values
    .slice(Math.max(0, upTo - 23), upTo + 1)
    .filter((v): v is number => v != null)
  if (window.length < 18) return { mean: null, hours: window.length }
  return { mean: window.reduce((s, v) => s + v, 0) / window.length, hours: window.length }
}

// ---------- Parsed shape (cached in the browser and in public/data/aqi-live.json) ----------

const n = z.number().nullable()
export const LiveCitySchema = z.object({
  /** Indian NAQI from 24-h mean PM (modelled). */
  naqi: n,
  dominant: z.enum(['pm25', 'pm10']).nullable(),
  pm25_24h: n,
  pm10_24h: n,
  hours: z.number(),
  pm25Now: n,
  pm10Now: n,
  usAqiNow: n,
  time: z.string().nullable(),
  tempC: n,
  tempMaxC: n,
  humidity: n,
})
export type LiveCity = z.infer<typeof LiveCitySchema>

export const LiveAirFileSchema = z.object({
  fetchedAt: z.string(),
  source: z.literal('open-meteo'),
  byCity: z.record(z.string(), LiveCitySchema),
})
export type LiveAirFile = z.infer<typeof LiveAirFileSchema>

const asArray = <T>(x: T | T[]): T[] => (Array.isArray(x) ? x : [x])
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10)

export function parseLiveAir(
  points: readonly Point[],
  airJson: OmAir | OmAir[],
  weatherJson: OmWeather | OmWeather[] | null,
  fetchedAt: string,
): LiveAirFile {
  const air = asArray(airJson)
  const wx = weatherJson ? asArray(weatherJson) : []
  if (air.length !== points.length)
    throw new Error(`Open-Meteo returned ${air.length} locations for ${points.length}`)
  const byCity: Record<string, LiveCity> = {}
  points.forEach((p, i) => {
    const a = air[i]!
    const w = wx[i]
    const now = a.current?.time ?? ''
    const times = a.hourly?.time ?? []
    const pm25 = mean24(times, a.hourly?.pm2_5, now)
    const pm10 = mean24(times, a.hourly?.pm10, now)
    const naqi = pmToNaqi(pm25.mean, pm10.mean)
    byCity[p.id] = {
      naqi: naqi?.aqi ?? null,
      dominant: naqi?.dominant ?? null,
      pm25_24h: r1(pm25.mean),
      pm10_24h: r1(pm10.mean),
      hours: Math.min(pm25.hours, pm10.hours),
      pm25Now: a.current?.pm2_5 ?? null,
      pm10Now: a.current?.pm10 ?? null,
      usAqiNow: a.current?.us_aqi ?? null,
      time: a.current?.time ?? null,
      tempC: w?.current?.temperature_2m ?? null,
      tempMaxC: w?.daily?.temperature_2m_max?.[0] ?? null,
      humidity: w?.current?.relative_humidity_2m ?? null,
    }
  })
  return { fetchedAt, source: 'open-meteo', byCity }
}

/** Downloads live data for all points (two requests in total). Weather failing is not fatal. */
export async function fetchLiveAir(
  points: readonly Point[],
  fetchFn: typeof fetch = fetch,
): Promise<LiveAirFile> {
  if (points.length === 0) throw new Error('No locations')
  const airRes = await fetchFn(airUrl(points))
  if (!airRes.ok) throw new Error(`Open-Meteo air quality HTTP ${airRes.status}`)
  const air = (await airRes.json()) as OmAir | OmAir[]
  let weather: OmWeather | OmWeather[] | null = null
  try {
    const wRes = await fetchFn(weatherUrl(points))
    if (wRes.ok) weather = (await wRes.json()) as OmWeather | OmWeather[]
  } catch {
    weather = null
  }
  return parseLiveAir(points, air, weather, new Date().toISOString())
}
