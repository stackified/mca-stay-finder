import { HOME_CITY, haversineKm } from '@/lib/geo'

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm(HOME_CITY, HOME_CITY)).toBe(0)
  })

  it('is symmetric', () => {
    const a = { lat: 17.984, lng: 79.53 }
    expect(haversineKm(HOME_CITY, a)).toBeCloseTo(haversineKm(a, HOME_CITY), 9)
  })

  it('gives about 111.2 km for 1 degree of latitude', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 1)
  })
})
