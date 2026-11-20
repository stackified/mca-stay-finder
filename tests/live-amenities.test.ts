import { buildSeed } from '../scripts/seed.ts'
import { AmenityIndex, amenityKind, rowToAmenity, type Amenity } from '@/lib/amenities'
import { DEFAULT_FILTERS, applyFilters, type FilterState } from '@/lib/filters'
import { destination } from '@/lib/geo'
import {
  LIVE_TTL_MS,
  airUrl,
  mean24,
  parseLiveAir,
  type LiveAirFile,
  type OmAir,
} from '@/lib/liveAir'
import { CACHE_KEY, loadLiveAir } from '@/lib/liveAirCache'
import { applyStayFilters } from '@/lib/stays'
import { decodeUrlState, encodeUrlState } from '@/lib/urlState'
import type { Stay } from '@/types/domain'

const seed = buildSeed('2026-11-20')
const cities = seed['cities.json'].data
const colleges = seed['colleges.json'].data

/** 48 local hourly timestamps for yesterday + today, like Open-Meteo returns. */
const hours = Array.from({ length: 48 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 19, i))
  return d.toISOString().slice(0, 16)
})

describe('mean24 (NAQI uses 24-h averages)', () => {
  it('averages the last 24 hours up to now', () => {
    const values = hours.map((_, i) => (i < 24 ? 1000 : 10)) // yesterday huge, today 10
    // Now = 2026-11-20T05:00 → window = 06:00 yesterday … 05:00 today: 18 × 1000 + 6 × 10
    const r = mean24(hours, values, '2026-11-20T05:00')
    expect(r.hours).toBe(24)
    expect(r.mean).toBeCloseTo((18 * 1000 + 6 * 10) / 24)
  })

  it('ignores nulls but needs ≥ 18 hours', () => {
    const someNull = hours.map((_, i) => (i % 4 === 0 ? null : 50))
    expect(mean24(hours, someNull, '2026-11-20T23:00').mean).toBe(50)
    const mostlyNull = hours.map((_, i) => (i % 2 === 0 ? null : 50))
    expect(mean24(hours, mostlyNull, '2026-11-20T23:00')).toEqual({ mean: null, hours: 12 })
  })
})

const points = [
  { id: 'warangal', lat: 17.97, lng: 79.59 },
  { id: 'trichy', lat: 10.79, lng: 78.7 },
]
const air = (pm25: number, pm10: number): OmAir => ({
  current: { time: '2026-11-20T05:00', pm2_5: pm25 + 1, pm10: pm10 + 1, us_aqi: 120 },
  hourly: { time: hours, pm2_5: hours.map(() => pm25), pm10: hours.map(() => pm10) },
})

describe('parseLiveAir', () => {
  it('computes NAQI per city from the 24-h means, with weather when present', () => {
    const f = parseLiveAir(
      points,
      [air(45, 40), air(20, 175)],
      [
        {
          current: { time: 'x', temperature_2m: 20, relative_humidity_2m: 60 },
          daily: { time: ['d'], temperature_2m_max: [28] },
        },
        {},
      ],
      '2026-11-20T00:00:00Z',
    )
    expect(f.byCity.warangal).toMatchObject({
      naqi: 75,
      dominant: 'pm25',
      pm25_24h: 45,
      tempC: 20,
      tempMaxC: 28,
      usAqiNow: 120,
    })
    expect(f.byCity.trichy).toMatchObject({ naqi: 150, dominant: 'pm10', tempC: null })
  })

  it('works without weather and rejects a location-count mismatch', () => {
    expect(parseLiveAir([points[0]!], air(10, 10), null, 'x').byCity.warangal?.naqi).toBe(17)
    expect(() => parseLiveAir(points, [air(1, 1)], null, 'x')).toThrow(/1 locations for 2/)
  })

  it('builds one request for all cities', () => {
    const u = new URL(airUrl(points))
    expect(u.searchParams.get('latitude')).toBe('17.9700,10.7900')
    expect(u.searchParams.get('hourly')).toBe('pm2_5,pm10')
  })
})

describe('loadLiveAir: 1-hour cache and fallback chain', () => {
  const NOW = Date.parse('2026-11-20T06:00:00Z')
  const file = (fetchedAt: string, ids = ['warangal', 'trichy']): LiveAirFile => ({
    fetchedAt,
    source: 'open-meteo',
    byCity: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          naqi: 60,
          dominant: 'pm25',
          pm25_24h: 36,
          pm10_24h: 30,
          hours: 24,
          pm25Now: 1,
          pm10Now: 1,
          usAqiNow: 1,
          time: 't',
          tempC: 20,
          tempMaxC: 28,
          humidity: 50,
        },
      ]),
    ) as LiveAirFile['byCity'],
  })
  const memStore = (init?: LiveAirFile) => {
    const m = new Map<string, string>(init ? [[CACHE_KEY, JSON.stringify(init)]] : [])
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      m,
    }
  }
  const okFetch = vi.fn<typeof fetch>(async (url) => {
    const body = String(url).includes('air-quality') ? [air(45, 40), air(20, 30)] : [{}, {}]
    return new Response(JSON.stringify(body), { status: 200 })
  })
  const downFetch = vi.fn<typeof fetch>(async () => {
    throw new TypeError('Failed to fetch')
  })

  it('uses a fresh cache without any request', async () => {
    const fetchFn = vi.fn<typeof fetch>()
    const r = await loadLiveAir({
      points,
      fetchFn,
      storage: memStore(file(new Date(NOW - 10 * 60_000).toISOString())),
      now: () => NOW,
    })
    expect(r.source).toBe('cache')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('refetches after 1 hour and stores the result', async () => {
    const store = memStore(file(new Date(NOW - LIVE_TTL_MS - 1).toISOString()))
    const r = await loadLiveAir({ points, fetchFn: okFetch, storage: store, now: () => NOW })
    expect(r.source).toBe('live')
    expect(r.data?.byCity.warangal?.naqi).toBe(75)
    expect(JSON.parse(store.m.get(CACHE_KEY)!).byCity.warangal.naqi).toBe(75)
  })

  it('refetches when the cache misses a city', async () => {
    const r = await loadLiveAir({
      points,
      fetchFn: okFetch,
      storage: memStore(file(new Date(NOW).toISOString(), ['warangal'])),
      now: () => NOW,
    })
    expect(r.source).toBe('live')
  })

  it('network down → stale cache', async () => {
    const r = await loadLiveAir({
      points,
      fetchFn: downFetch,
      storage: memStore(file('2026-11-18T00:00:00Z')),
      now: () => NOW,
    })
    expect(r).toMatchObject({ source: 'stale-cache', error: 'Failed to fetch' })
    expect(r.data?.fetchedAt).toBe('2026-11-18T00:00:00Z')
  })

  it('network down, no cache → bundled snapshot', async () => {
    const r = await loadLiveAir({
      points,
      fetchFn: downFetch,
      storage: memStore(),
      now: () => NOW,
      loadSnapshot: async () => file('2026-11-20T00:51:47Z'),
    })
    expect(r.source).toBe('snapshot')
  })

  it('nothing at all → none (never throws)', async () => {
    const r = await loadLiveAir({
      points,
      fetchFn: downFetch,
      storage: null,
      loadSnapshot: async () => {
        throw new Error('404')
      },
    })
    expect(r).toMatchObject({ source: 'none', data: null })
  })

  it('survives a corrupt cache and a throwing storage', async () => {
    const bad = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('quota')
      },
    }
    const r = await loadLiveAir({ points, fetchFn: okFetch, storage: bad, now: () => NOW })
    expect(r.source).toBe('live')
  })
})

describe('live AQI filter', () => {
  const f = (patch: Partial<FilterState>): FilterState => ({
    ...(structuredClone(DEFAULT_FILTERS) as FilterState),
    ...patch,
  })
  const live: Record<string, number> = { warangal: 92, trichy: 90, prayagraj: 315, delhi: 284 }
  const ids = (filters: FilterState, liveNaqi?: (id: string) => number | undefined) =>
    applyFilters(colleges, cities, filters, { liveNaqi })
      .filter((o) => o.visible)
      .map((o) => o.college.id)

  it('keeps cities at or under the live limit; unknown live values fail', () => {
    const r = ids(f({ liveAqiMax: 100 }), (id) => live[id])
    expect(r.sort()).toEqual(['nit-trichy', 'nit-warangal'])
  })

  it('with no live data, an active live filter shows nothing (and the UI disables it)', () => {
    expect(ids(f({ liveAqiMax: 100 }))).toEqual([])
  })

  it('is off by default', () => {
    expect(ids(f({}))).toHaveLength(14)
  })
})

describe('amenities', () => {
  it.each([
    [{ shop: 'supermarket' }, 'grocery'],
    [{ amenity: 'clinic' }, 'hospital'],
    [{ healthcare: 'hospital' }, 'hospital'],
    [{ amenity: 'pharmacy' }, 'pharmacy'],
    [{ shop: 'chemist' }, 'pharmacy'],
    [{ leisure: 'fitness_centre' }, 'gym'],
    [{ highway: 'bus_stop' }, 'bus_stop'],
    [{ railway: 'station' }, 'railway'],
    [{ amenity: 'restaurant' }, 'restaurant'],
    [{ amenity: 'bank' }, null],
  ] as const)('amenityKind(%o) = %s', (tags, kind) => {
    expect(amenityKind({ ...tags })).toBe(kind)
  })

  const campus = { lat: 17.98335, lng: 79.53352 }
  const at = (km: number, kind: Amenity['kind'], bearing = 90): Amenity => ({
    kind,
    ...destination(campus, km, bearing),
  })
  const index = new AmenityIndex([
    at(0.3, 'grocery'),
    at(1.5, 'hospital'),
    at(0.45, 'bus_stop', 180),
    at(5, 'railway'),
  ])

  it('finds the nearest amenity of a kind within a radius', () => {
    expect(index.nearest(campus, 'grocery', 500)?.meters).toBeCloseTo(300, -1)
    expect(index.has(campus, 'hospital', 1000)).toBe(false)
    expect(index.has(campus, 'hospital', 2000)).toBe(true)
    expect(index.has(campus, 'railway', 2000)).toBe(false)
    expect(index.has(campus, 'gym', 2000)).toBe(false)
  })

  it('matches a brute-force scan on random points', () => {
    const rand = (i: number) => (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1
    const all: Amenity[] = Array.from({ length: 400 }, (_, i) =>
      at(rand(i) * 6, 'grocery', rand(i + 1000) * 360),
    )
    const idx = new AmenityIndex(all)
    for (let i = 0; i < 50; i++) {
      const p = destination(campus, rand(i + 2000) * 5, rand(i + 3000) * 360)
      const brute = all.some(
        (a) =>
          Math.hypot(
            (a.lat - p.lat) * 111.2,
            (a.lng - p.lng) * 111.2 * Math.cos((p.lat * Math.PI) / 180),
          ) *
            1000 <=
          800,
      )
      expect(idx.has(p, 'grocery', 800)).toBe(brute)
    }
  })

  it('stay filter: every checked amenity must be within the radius', () => {
    const stay = (id: string, km: number): Stay => ({
      id,
      source: 'osm',
      name: id,
      type: 'pg',
      ...destination(campus, km, 90),
      nearestCollegeId: 'nit-warangal',
      distanceKm: km,
    })
    const stays = [stay('near-grocery', 0.25), stay('far', 3)]
    const base = { ...(structuredClone(DEFAULT_FILTERS) as FilterState) }
    const run = (patch: Partial<FilterState>, amenities: AmenityIndex | null = index) =>
      applyStayFilters(
        stays,
        { ...base, ...patch },
        { selected: { id: 'c', ...campus }, campuses: [], amenities },
      ).map((r) => r.stay.id)
    expect(run({ stayAmenities: ['grocery'], stayAmenityRadiusM: 200 })).toEqual(['near-grocery'])
    expect(run({ stayAmenities: ['grocery', 'gym'], stayAmenityRadiusM: 500 })).toEqual([])
    expect(run({ stayAmenities: ['grocery'] }, null)).toEqual([]) // no amenity data
    expect(run({})).toEqual(['near-grocery', 'far']) // off by default
  })

  it('rowToAmenity keeps the name only when present', () => {
    expect(rowToAmenity(['gym', 1, 2])).toEqual({ kind: 'gym', lat: 1, lng: 2 })
    expect(rowToAmenity(['gym', 1, 2, 'Gold'])).toEqual({
      kind: 'gym',
      lat: 1,
      lng: 2,
      name: 'Gold',
    })
  })
})

describe('URL state for Phase 6 filters', () => {
  it('round-trips live AQI and amenity filters', () => {
    const s = decodeUrlState('')
    s.filters.liveAqiMax = 100
    s.filters.stayAmenities = ['grocery', 'hospital']
    s.filters.stayAmenityRadiusM = 800
    const q = encodeUrlState(s)
    expect(q).toContain('live=100')
    expect(q).toContain('amen=grocery,hospital')
    expect(decodeUrlState(q)).toEqual(s)
  })
})
