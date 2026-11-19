import { naqiBand, pm10SubIndex, pm25SubIndex, pmToNaqi } from '@/lib/naqi'

describe('pm25SubIndex', () => {
  it.each([
    [0, 0],
    [30, 50],
    [45, 75],
    [60, 100],
    [75, 150],
    [90, 200],
    [120, 300],
    [250, 400],
    [380, 500],
  ])('PM2.5 %d → %d', (c, expected) => {
    expect(pm25SubIndex(c)).toBeCloseTo(expected, 6)
  })

  it('clamps above the Severe band to 500', () => {
    expect(pm25SubIndex(900)).toBe(500)
  })

  it('rejects negative and non-finite values', () => {
    expect(() => pm25SubIndex(-1)).toThrow(RangeError)
    expect(() => pm25SubIndex(Number.NaN)).toThrow(RangeError)
  })
})

describe('pm10SubIndex', () => {
  it.each([
    [50, 50],
    [100, 100],
    [175, 150],
    [250, 200],
    [350, 300],
    [430, 400],
  ])('PM10 %d → %d', (c, expected) => {
    expect(pm10SubIndex(c)).toBeCloseTo(expected, 6)
  })
})

describe('pmToNaqi', () => {
  it('returns null when both values are missing', () => {
    expect(pmToNaqi(null, undefined)).toBeNull()
  })

  it('uses the larger sub-index', () => {
    // PM2.5 45 → 75; PM10 175 → 150. PM10 dominates.
    expect(pmToNaqi(45, 175)).toEqual({ aqi: 150, band: 'Moderate', dominant: 'pm10' })
  })

  it('works with PM2.5 only (seed cities Agartala and Shillong)', () => {
    expect(pmToNaqi(20.3)).toEqual({ aqi: 34, band: 'Good', dominant: 'pm25' })
    expect(pmToNaqi(8.5)).toEqual({ aqi: 14, band: 'Good', dominant: 'pm25' })
  })
})

describe('naqiBand', () => {
  it.each([
    [50, 'Good'],
    [51, 'Satisfactory'],
    [100, 'Satisfactory'],
    [200, 'Moderate'],
    [300, 'Poor'],
    [400, 'Very Poor'],
    [401, 'Severe'],
  ] as const)('%d → %s', (aqi, band) => {
    expect(naqiBand(aqi)).toBe(band)
  })
})
