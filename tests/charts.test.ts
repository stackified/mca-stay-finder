import { buildSeed } from '../scripts/seed.ts'
import { aqiBars, costBreakdown, radarData } from '@/lib/charts'

const cities = buildSeed('2026-11-20')['cities.json'].data
const mid = (r: { min: number; max: number }) => (r.min + r.max) / 2

describe('costBreakdown', () => {
  it('1BHK parts add up to the SPEC §11.4 all-in midpoint', () => {
    const rows = costBreakdown(cities, 'flat_1bhk')
    const gaps = rows.map((row) => {
      const c = cities.find((x) => x.id === row.cityId)!
      return Math.abs(row.total - mid(c.costs!.flat1bhkAllIn))
    })
    expect(rows.length).toBeGreaterThan(10)
    expect(Math.max(...gaps)).toBeLessThan(1e-6)
  })

  it('PG double: rent includes food, so food is 0', () => {
    const w = costBreakdown(cities, 'pg_double').find((r) => r.cityId === 'warangal')!
    expect(w).toMatchObject({ rent: 5750, food: 0, utilities: 1050, transport: 1150, misc: 2500 })
  })

  it('leaves out cities without cost data and sorts cheapest first', () => {
    const rows = costBreakdown(cities, 'flat_1bhk')
    expect(rows.map((r) => r.cityId)).not.toContain('diu')
    expect(rows.map((r) => r.total)).toEqual([...rows.map((r) => r.total)].sort((a, b) => a - b))
  })
})

describe('aqiBars', () => {
  it('pairs annual with live and marks estimates', () => {
    const rows = aqiBars(cities, { delhi: { naqi: 294 }, diu: { naqi: 85 } })
    expect(rows.find((r) => r.cityId === 'delhi')).toMatchObject({
      annual: 200,
      live: 294,
      estimate: false,
    })
    expect(rows.find((r) => r.cityId === 'warangal')).toMatchObject({
      annual: 68,
      live: null,
      estimate: true,
    })
    // Diu has no annual figure but has a live one → kept, sorted last.
    expect(rows.at(-1)).toMatchObject({ cityId: 'diu', annual: null, live: 85 })
  })

  it('without live data, cities with no annual figure are left out', () => {
    expect(aqiBars(cities).map((r) => r.cityId)).not.toContain('diu')
  })
})

describe('radarData', () => {
  it('one row per axis, one column per college, skipping unscored', () => {
    const rows = radarData([
      { name: 'A', scores: { placement: 9.5, air: 8.5, cost: 9, living: 7 } },
      { name: 'B', scores: null },
    ])
    expect(rows).toEqual([
      { axis: 'Placement', A: 9.5 },
      { axis: 'Air', A: 8.5 },
      { axis: 'Cost', A: 9 },
      { axis: 'Living', A: 7 },
    ])
  })
})
