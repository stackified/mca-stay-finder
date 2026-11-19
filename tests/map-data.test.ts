import { buildSeed } from '../scripts/seed.ts'
import { citiesToAqiGeoJSON, collegeMarkers, markerSize } from '@/lib/mapData'
import { DEFAULT_WEIGHTS, finalScore, formatScore, scoreBand } from '@/lib/scoring'
import { formatInrRange } from '@/lib/format'

const seed = buildSeed('2026-11-20')
const cities = seed['cities.json'].data
const colleges = seed['colleges.json'].data

describe('finalScore', () => {
  const s = { placement: 9.5, air: 8.5, cost: 9, living: 7 }

  it('uses the SPEC §10 formula with default weights', () => {
    expect(finalScore(s)).toBeCloseTo(8.775, 9)
  })

  it('returns null for missing scores', () => {
    expect(finalScore(null)).toBeNull()
  })

  it('rejects weights that do not sum to 100', () => {
    expect(() => finalScore(s, { ...DEFAULT_WEIGHTS, placement: 50 })).toThrow(RangeError)
  })
})

describe('scoreBand', () => {
  it.each([
    [8, 'high'],
    [7.99, 'mid'],
    [6, 'mid'],
    [5.99, 'low'],
    [null, 'none'],
  ] as const)('%s → %s', (score, band) => {
    expect(scoreBand(score)).toBe(band)
  })

  it('formats to one decimal', () => {
    expect(formatScore(8.775)).toBe('8.8')
    expect(formatScore(null)).toBe('–')
  })
})

describe('citiesToAqiGeoJSON', () => {
  const fc = citiesToAqiGeoJSON(cities)

  it('leaves out cities with no AQI (Gandhinagar, Diu)', () => {
    const ids = fc.features.map((f) => f.properties.id)
    expect(ids).not.toContain('gandhinagar')
    expect(ids).not.toContain('diu')
    expect(fc.features).toHaveLength(cities.filter((c) => c.annualAQI.value !== null).length)
  })

  it('uses [lng, lat] order and band colours, with a text label', () => {
    const delhi = fc.features.find((f) => f.properties.id === 'delhi')!
    expect(delhi.geometry.coordinates).toEqual([77.209, 28.6139])
    expect(delhi.properties).toMatchObject({ aqi: 200, band: 'Moderate', color: '#ffd700' })
    expect(delhi.properties.label).toBe('Delhi\nAQI 200 · Moderate')
  })

  it('marks estimates with "~"', () => {
    const w = fc.features.find((f) => f.properties.id === 'warangal')!
    expect(w.properties.label).toContain('AQI ~68')
  })
})

describe('collegeMarkers', () => {
  it('hides IIIT and excluded-city colleges by default (SPEC §2)', () => {
    const ids = collegeMarkers(colleges, cities).map((m) => m.college.id)
    expect(ids).toHaveLength(14)
    expect(ids.some((id) => id.startsWith('iiit-'))).toBe(false)
  })

  it('shows IIIT on request, but still hides the excluded city', () => {
    const ids = collegeMarkers(colleges, cities, { showIIIT: true, showExcluded: false }).map(
      (m) => m.college.id,
    )
    expect(ids).toContain('iiit-bhopal')
    expect(ids).toContain('iiit-vadodara-diu')
    expect(ids).not.toContain('iiit-vadodara-gandhinagar')
  })

  it('colours by score and flags VIT as backup', () => {
    const byId = new Map(collegeMarkers(colleges, cities).map((m) => [m.college.id, m]))
    expect(byId.get('nit-warangal')).toMatchObject({ band: 'high', isBackup: false })
    expect(byId.get('nit-jamshedpur')?.band).toBe('mid')
    expect(byId.get('nit-delhi')?.band).toBe('low')
    expect(byId.get('vit-vellore')?.isBackup).toBe(true)
  })
})

describe('markerSize', () => {
  it('grows with seats and is capped', () => {
    expect(markerSize(null)).toBe(22)
    expect(markerSize(20)).toBeLessThan(markerSize(160))
    expect(markerSize(10_000)).toBe(40)
  })
})

describe('formatInrRange', () => {
  it('shows thousands', () => {
    expect(formatInrRange({ min: 8500, max: 12500 })).toBe('₹8.5k–12.5k')
    expect(formatInrRange(null)).toBe('–')
  })
})
