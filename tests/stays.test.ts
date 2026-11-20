import {
  allInEstimate,
  dedupeStays,
  isNotAStay,
  overpassQuery,
  stayGender,
  stayType,
  toStay,
} from '../scripts/osm-stays-lib.ts'
import { buildSeed } from '../scripts/seed.ts'
import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters'
import { osmUrl, rentalLinks } from '@/lib/deeplinks'
import { destination } from '@/lib/geo'
import {
  applyStayFilters,
  changedStayFilters,
  commuteMinutes,
  type StayFilterState,
} from '@/lib/stays'
import { decodeUrlState, encodeUrlState } from '@/lib/urlState'
import type { Stay } from '@/types/domain'

const campus = { id: 'nit-warangal', lat: 17.98335, lng: 79.53352 }
const other = { id: 'nit-trichy', lat: 10.76339, lng: 78.81503 }

/** A stay `km` north of the Warangal campus. */
const stay = (id: string, km: number, patch: Partial<Stay> = {}): Stay => {
  const p = destination(campus, km, 0)
  return {
    id,
    source: 'osm',
    name: id,
    type: 'pg',
    lat: p.lat,
    lng: p.lng,
    nearestCollegeId: campus.id,
    distanceKm: km,
    ...patch,
  }
}

const f = (patch: Partial<StayFilterState> = {}): FilterState => ({
  ...(structuredClone(DEFAULT_FILTERS) as FilterState),
  ...patch,
})

const ids = (stays: Stay[], filters: FilterState, selected: typeof campus | null = campus) =>
  applyStayFilters(stays, filters, { selected, campuses: [campus, other] }).map((r) => r.stay.id)

describe('distance (radius ring)', () => {
  const stays = [stay('a', 0.4), stay('b', 1.9), stay('c', 4.9), stay('d', 7)]

  it('keeps only stays inside the ring, nearest first', () => {
    expect(ids(stays, f({ stayMaxDistanceKm: 5 }))).toEqual(['a', 'b', 'c'])
    expect(ids(stays, f({ stayMaxDistanceKm: 2 }))).toEqual(['a', 'b'])
    expect(ids(stays, f({ stayMaxDistanceKm: 0.5 }))).toEqual(['a'])
  })

  it('reports the distance to the selected campus', () => {
    const r = applyStayFilters(stays, f(), { selected: campus, campuses: [] })
    expect(r[0]!.distanceKm).toBeCloseTo(0.4, 2)
  })

  it('without a selection, uses the nearest visible campus', () => {
    expect(ids(stays, f({ stayMaxDistanceKm: 5 }), null)).toEqual(['a', 'b', 'c'])
    const r = applyStayFilters(stays, f(), { selected: null, campuses: [other] })
    expect(r).toHaveLength(0) // Trichy is ~800 km away
  })
})

describe('SPEC §13 item 6: stay type + budget + food combine with AND', () => {
  const stays = [
    stay('pg-cheap-food', 1, { type: 'pg', allInEstimate: { min: 8000, max: 11000 }, food: true }),
    stay('pg-cheap-nofood', 1, {
      type: 'pg',
      allInEstimate: { min: 8000, max: 11000 },
      food: false,
    }),
    stay('pg-dear-food', 1, { type: 'pg', allInEstimate: { min: 16000, max: 20000 }, food: true }),
    stay('flat-cheap-food', 1, {
      type: 'apartment',
      allInEstimate: { min: 9000, max: 12000 },
      food: true,
    }),
    stay('pg-unknown-price', 1, { type: 'pg', food: true }),
    stay('hostel-cheap-food', 1, {
      type: 'hostel',
      allInEstimate: { min: 7000, max: 9000 },
      food: true,
    }),
  ]

  it('type only', () => {
    expect(ids(stays, f({ stayTypes: ['pg'] })).sort()).toEqual([
      'pg-cheap-food',
      'pg-cheap-nofood',
      'pg-dear-food',
      'pg-unknown-price',
    ])
  })

  it('type + budget', () => {
    expect(ids(stays, f({ stayTypes: ['pg'], stayBudgetMax: 12000 })).sort()).toEqual([
      'pg-cheap-food',
      'pg-cheap-nofood',
    ])
  })

  it('type + budget + food', () => {
    expect(ids(stays, f({ stayTypes: ['pg'], stayBudgetMax: 12000, stayFoodOnly: true }))).toEqual([
      'pg-cheap-food',
    ])
  })

  it('budget uses range overlap (a ₹16k–20k PG fits a ≥ ₹19k budget)', () => {
    expect(ids(stays, f({ stayTypes: ['pg'], stayBudgetMin: 19000 }))).toEqual(['pg-dear-food'])
  })

  it('unknown values fail an active filter', () => {
    expect(ids(stays, f({ stayTypes: ['pg'], stayBudgetMin: 1 }))).not.toContain('pg-unknown-price')
    expect(ids([stay('x', 1, { type: 'pg' })], f({ stayFoodOnly: true }))).toEqual([])
  })

  it('default types are PG + flat + bungalow (hostel hidden)', () => {
    expect(ids(stays, f())).not.toContain('hostel-cheap-food')
    expect(ids(stays, f())).toContain('flat-cheap-food')
  })
})

describe('other stay filters', () => {
  it('sharing affects only PG/hostel', () => {
    const stays = [
      stay('pg-double', 1, { sharing: 'double' }),
      stay('pg-single', 1, { sharing: 'single' }),
      stay('flat', 1, { type: 'apartment' }),
    ]
    expect(ids(stays, f({ staySharing: ['double'] })).sort()).toEqual(['flat', 'pg-double'])
  })

  it('gender "any" also matches stays with no stated gender', () => {
    const stays = [
      stay('boys', 1, { gender: 'boys' }),
      stay('girls', 1, { gender: 'girls' }),
      stay('open', 1),
    ]
    expect(ids(stays, f({ stayGender: ['boys', 'any'] })).sort()).toEqual(['boys', 'open'])
  })

  it('travel time uses distance × 1.3 at 20 km/h', () => {
    expect(commuteMinutes(5)).toBe(20) // 6.5 road km
    const stays = [stay('near', 1), stay('far', 4.9)]
    expect(ids(stays, f({ stayTravelMaxMin: 10 }))).toEqual(['near'])
  })

  it('source filter', () => {
    const stays = [stay('osm', 1), stay('mine', 1, { source: 'mine' })]
    expect(ids(stays, f({ staySources: ['mine'] }))).toEqual(['mine'])
  })

  it('reports changed stay filters', () => {
    expect(changedStayFilters(f())).toEqual([])
    expect(changedStayFilters(f({ stayFoodOnly: true, stayBudgetMax: 9000 }))).toEqual([
      'budget',
      'food',
    ])
  })

  it('stay filters round-trip through the URL', () => {
    const filters = f({
      stayTypes: ['pg', 'hostel'],
      stayMaxDistanceKm: 2,
      stayBudgetMax: 12000,
      stayFoodOnly: true,
      stayGender: ['boys', 'any'],
      staySources: ['mine'],
      stayTravelMaxMin: 15,
    })
    const state = {
      filters,
      weights: { placement: 40, air: 25, cost: 20, living: 15 },
      scoreMode: 'seed' as const,
      sorting: [],
      selectedCollegeId: null,
    }
    const q = encodeUrlState(state)
    expect(q).toContain('stay=2')
    expect(decodeUrlState(q)).toEqual(state)
  })
})

describe('OSM normalisation (scripts/osm-stays-lib.ts)', () => {
  it.each([
    [{ tourism: 'hostel', name: 'Zostel' }, 1, 'hostel'],
    [{ name: 'Sri Sai Boys PG' }, 1, 'pg'],
    [{ name: 'Lakshmi Girls Hostel' }, 1, 'hostel'],
    [{ tourism: 'guest_house', name: 'Green Inn' }, 1, 'guest_house'],
    [{ building: 'apartments', name: 'Sky Towers' }, 1, 'apartment'],
    [{ name: 'Lake View Residency' }, 1, 'apartment'],
    [{ building: 'house', name: 'Rao Villa' }, 1, 'bungalow'],
    [{ building: 'dormitory', name: 'Hall 7' }, 0.5, 'campus_hostel'],
    [{ building: 'dormitory', name: 'Hall 7' }, 5, 'hostel'],
    [{ name: 'Upgrade Mobile Store' }, 1, 'unknown'],
  ] as const)('%o at %s km → %s', (tags, km, type) => {
    expect(stayType({ ...tags }, km)).toBe(type)
  })

  it.each([
    [{ name: 'Fatima Girls High School', amenity: 'school' }, true],
    [{ name: 'Fatima Girls High School', building: 'yes' }, true], // name rule
    [{ name: 'Route to 1.8k Hostel', highway: 'footway' }, true],
    [{ name: 'Hostel Office', building: 'yes' }, true],
    [{ name: "Director's Bunglow", building: 'house' }, true],
    [{ name: 'Staff Quarters', building: 'apartments' }, true],
    [{ name: 'Sambasiah welding shop', building: 'house' }, true],
    [{ name: 'Manikanta jewellry shop', building: 'yes' }, true],
    [{ name: 'Green Enclave', place: 'neighbourhood' }, true], // a whole area
    [{ name: 'Green Park', landuse: 'residential' }, true],
    [{ name: 'Tulsi Apartments', landuse: 'residential' }, false], // housing society
    [{ name: 'Surendra Residency', landuse: 'residential' }, false],
    [{ name: 'Tulsi Apartments', landuse: 'commercial' }, true],
    [{ name: 'MG Road Guest House', tourism: 'guest_house' }, false], // tag wins
    [{ name: 'Sri Sai Boys PG', building: 'yes' }, false],
    [{ name: 'Sky Towers', building: 'apartments' }, false],
    [{ name: 'Abhaya Residency Appartment', building: 'apartments' }, false],
  ] as const)('isNotAStay(%o) = %s', (tags, expected) => {
    expect(isNotAStay({ ...tags })).toBe(expected)
  })

  it('reads gender from the name', () => {
    expect(stayGender('Sri Sai Boys PG')).toBe('boys')
    expect(stayGender('Ladies Hostel')).toBe('girls')
    expect(stayGender('Zolo Co-living')).toBe('coliving')
    expect(stayGender('Sky Towers')).toBeUndefined()
  })

  const seed = buildSeed('2026-11-20')
  const warangal = seed['cities.json'].data.find((c) => c.id === 'warangal')!
  const locs = seed['localities.json'].data.filter((l) => l.collegeId === 'nit-warangal')

  it('drops unnamed objects and uses way centres', () => {
    expect(
      toStay(
        { type: 'node', id: 1, lat: 18, lon: 79.5, tags: { tourism: 'hostel' } },
        campus,
        warangal,
        locs,
      ),
    ).toBeNull()
    const s = toStay(
      {
        type: 'way',
        id: 2,
        center: { lat: 17.99, lon: 79.535 },
        tags: { name: 'Sai Boys PG', building: 'yes', phone: '+91 1' },
      },
      campus,
      warangal,
      locs,
    )!
    expect(s).toMatchObject({
      id: 'osm-way-2',
      osmId: 'way/2',
      type: 'pg',
      gender: 'boys',
      phone: '+91 1',
      source: 'osm',
    })
    expect(s.distanceKm).toBeGreaterThan(0)
  })

  it('estimates all-in cost from the nearest locality, else the city', () => {
    const atGate = locs.find((l) => l.id === 'nitw-fathima-nagar')!
    expect(allInEstimate('pg', atGate, warangal, locs)).toEqual(atGate.pgDoubleAllIn)
    expect(allInEstimate('apartment', { lat: 18.3, lng: 79.9 }, warangal, locs)).toEqual(
      warangal.costs!.flat1bhkAllIn,
    )
    expect(allInEstimate('campus_hostel', atGate, warangal, locs)).toBeUndefined()
  })

  it('dedupes by OSM id, keeping the nearest campus', () => {
    const a = stay('osm-node-1', 3, { nearestCollegeId: 'x' })
    const b = stay('osm-node-1', 1, { nearestCollegeId: 'y' })
    expect(dedupeStays([a, b])).toEqual([b])
  })

  it('builds the SPEC §9 query', () => {
    const q = overpassQuery(17.98, 79.53)
    expect(q).toContain('around:10000,17.98,79.53')
    expect(q).toContain('out center tags;')
    // Overpass rejects a set filter without a type (".named[...]" → HTTP 400).
    expect(q).not.toMatch(/^\s*\.named\[/m)
    expect(q.match(/nwr\.named\[/g)).toHaveLength(3)
  })
})

describe('rental deep links (SPEC §9)', () => {
  it('are Google searches limited to each site, plus one open search', () => {
    const links = rentalLinks('Kazipet', 'Warangal', 'pg')
    expect(links.map((l) => l.label)).toEqual([
      'NoBroker',
      'MagicBricks',
      '99acres',
      'Housing.com',
      'Google',
    ])
    expect(links[0]!.url).toBe(
      'https://www.google.com/search?q=PG%20Kazipet%20Warangal%20site%3Anobroker.in',
    )
    expect(links.every((l) => l.url.startsWith('https://www.google.com/search?q='))).toBe(true)
  })

  it('use flat words for apartments and avoid repeating the city', () => {
    expect(rentalLinks('Warangal', 'Warangal', 'apartment')[4]!.url).toContain(
      encodeURIComponent('1BHK flat for rent near Warangal'),
    )
  })

  it('link to the OSM object', () => {
    expect(osmUrl('way/2')).toBe('https://www.openstreetmap.org/way/2')
  })
})
