import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildSeed, DATA_DIR, type SeedFiles } from '../scripts/seed.ts'
import {
  CitiesFileSchema,
  CollegesFileSchema,
  LocalitiesFileSchema,
  type City,
  type College,
} from '@/types/domain'

const read = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(DATA_DIR, name), 'utf8')) as unknown

const cities = CitiesFileSchema.parse(read('cities.json'))
const colleges = CollegesFileSchema.parse(read('colleges.json'))
const localities = LocalitiesFileSchema.parse(read('localities.json'))

const cityById = new Map<string, City>(cities.data.map((c) => [c.id, c]))
const college = (id: string): College => {
  const c = colleges.data.find((x) => x.id === id)
  if (!c) throw new Error(`no college ${id}`)
  return c
}

describe('public/data JSON', () => {
  it('validates against the zod schemas (Phase 1 done-criterion)', () => {
    expect(cities.data.length).toBeGreaterThan(0)
    expect(colleges.data.length).toBeGreaterThan(0)
    expect(localities.data.length).toBeGreaterThan(0)
  })

  it('is up to date with the seed tables (run `npm run data:seed` if this fails)', () => {
    const fresh: SeedFiles = buildSeed(cities.meta.generatedAt)
    expect(fresh['cities.json'].data).toEqual(cities.data)
    expect(fresh['colleges.json'].data).toEqual(colleges.data)
    expect(fresh['localities.json'].data).toEqual(localities.data)
  })

  it('has the 11 NIMCET NITs and 3 VIT backups from SPEC §11.1', () => {
    expect(colleges.data.filter((c) => c.type === 'NIT')).toHaveLength(11)
    expect(colleges.data.filter((c) => c.type === 'VIT')).toHaveLength(3)
    expect(
      colleges.data.filter((c) => c.type === 'VIT').every((c) => c.entrance === 'VITMEE'),
    ).toBe(true)
  })
})

describe('seed scores', () => {
  const weighted = (s: NonNullable<College['defaultScores']>) =>
    (40 * s.placement + 25 * s.air + 20 * s.cost + 15 * s.living) / 100

  it.each(
    colleges.data
      .filter((c) => c.defaultScores && c.seedFinal !== null)
      .map((c) => [c.id, c] as const),
  )(
    '%s: default weights reproduce the SPEC final score (±0.05, SPEC rounds to 1 decimal)',
    (_id, c) => {
      // 1e-9 absorbs float error: MANIT is exactly 7.45 → SPEC shows 7.5.
      expect(Math.abs(weighted(c.defaultScores!) - c.seedFinal!)).toBeLessThanOrEqual(0.05 + 1e-9)
    },
  )
})

describe('cities', () => {
  it('annual AQI ≤ 100 removes Delhi, Patna, Bhopal, Jamshedpur and Kurukshetra (SPEC §13 item 1 data)', () => {
    const over100 = cities.data
      .filter((c) => c.annualAQI.value !== null && c.annualAQI.value > 100)
      .map((c) => c.id)
      .sort()
    expect(over100).toEqual(['bhopal', 'delhi', 'jamshedpur', 'kurukshetra', 'patna'])
  })

  it('derives Agartala and Shillong NAQI from PM2.5 (both Good)', () => {
    expect(cityById.get('agartala')?.annualAQI.value).toBe(34)
    expect(cityById.get('shillong')?.annualAQI.value).toBe(14)
  })

  it('applies the SPEC §11.4 flat formulas (Warangal)', () => {
    const w = cityById.get('warangal')?.costs
    expect(w?.runningTotal).toEqual({ min: 8800, max: 14500 })
    expect(w?.flat1bhkAllIn).toEqual({ min: 6000 + 8800, max: 9000 + 14500 })
    expect(w?.flat2bhkAllIn).toEqual({ min: 9000 + 8800 + 1000, max: 13000 + 14500 + 1000 })
    expect(w?.bungalowAllIn).toEqual({ min: 14000 + 8800 + 2000, max: 22000 + 14500 + 4000 })
  })

  it('running totals match the SPEC §11.4 table', () => {
    const expected: Record<string, [number, number]> = {
      delhi: [11300, 19800],
      kurukshetra: [9200, 14900],
      prayagraj: [9500, 15700],
      bhopal: [9500, 16500],
      raipur: [9400, 15500],
      patna: [9500, 16300],
      jamshedpur: [9300, 15100],
      agartala: [10000, 15700],
      shillong: [11600, 18700],
      warangal: [8800, 14500],
      trichy: [9000, 15300],
    }
    const actual = Object.fromEntries(
      Object.keys(expected).map((id) => {
        const t = cityById.get(id)?.costs?.runningTotal
        return [id, t ? [t.min, t.max] : null]
      }),
    )
    expect(actual).toEqual(expected)
  })

  it('marks borrowed cost tables with a note', () => {
    const ids = ['vellore', 'chennai-kelambakkam', 'sehore']
    const notes = ids.map((id) => cityById.get(id)?.costs?.note ?? '')
    expect(notes.every((n) => n.includes('borrowed'))).toBe(true)
  })

  it('keeps excluded cities unscored and their colleges unranked', () => {
    const excluded = cities.data.filter((c) => c.excluded)
    expect(excluded.map((c) => c.id)).toEqual(['gandhinagar'])
    expect(college('iiit-vadodara-gandhinagar').defaultScores).toBeNull()
  })

  it('stores Surat distance at city level only', () => {
    expect(cityById.get('bhopal')?.distanceFromHomeKm).toBeGreaterThan(450)
    expect(cityById.get('bhopal')?.distanceFromHomeKm).toBeLessThan(600)
  })
})

describe('localities', () => {
  it('cover the top 6 campuses with 3 localities each', () => {
    const per = new Map<string, number>()
    for (const l of localities.data) per.set(l.collegeId, (per.get(l.collegeId) ?? 0) + 1)
    expect([...per.keys()].sort()).toEqual([
      'manit-bhopal',
      'mnnit-allahabad',
      'nit-jamshedpur',
      'nit-raipur',
      'nit-trichy',
      'nit-warangal',
    ])
    expect([...per.values()].every((n) => n === 3)).toBe(true)
  })
})

describe('integrity checks', () => {
  it('reject a null value with a non-"none" confidence', () => {
    const bad = structuredClone(read('colleges.json')) as { data: { seats: unknown }[] }
    bad.data[0]!.seats = { value: null, confidence: 'official' }
    expect(CollegesFileSchema.safeParse(bad).success).toBe(false)
  })
})
