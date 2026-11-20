import 'fake-indexeddb/auto'
import { ZodError } from 'zod'
import { buildSeed } from '../scripts/seed.ts'
import { computeBudget, parseMonths } from '@/lib/budget'
import { csvCell, listingsCsv, ownerNotesCsv, toCsv } from '@/lib/csv'
import { DEFAULT_FILTERS, type FilterState } from '@/lib/filters'
import { buildListing, listingAllIn, safeUrl } from '@/lib/listings'
import { applyStayFilters } from '@/lib/stays'
import {
  AppDB,
  deleteListing,
  exportAll,
  importAll,
  saveListing,
  savePreset,
  setChecklist,
  setNote,
  setStatus,
  toggleShortlist,
} from '@/store/db'
import { entityKey, type ExportFile } from '@/types/userData'

const seed = buildSeed('2026-11-20')
const warangalCampus = seed['colleges.json'].data.find((c) => c.id === 'nit-warangal')!
const warangal = seed['cities.json'].data.find((c) => c.id === 'warangal')!

let dbCounter = 0
const freshDb = () => new AppDB(`test-${++dbCounter}`)

const listing = (patch: Partial<Parameters<typeof buildListing>[0]> = {}) =>
  buildListing(
    {
      name: 'Sai Boys PG',
      type: 'pg',
      collegeId: warangalCampus.id,
      lat: 17.99,
      lng: 79.535,
      rent: 7000,
      food: true,
      sharing: 'double',
      ...patch,
    },
    warangalCampus,
    warangal,
  )

describe('buildListing (SPEC §6.5 Add my listing)', () => {
  it('builds an own stay with distance to the chosen campus', () => {
    const s = listing()
    expect(s.source).toBe('mine')
    expect(s.id).toMatch(/^mine-/)
    expect(s.nearestCollegeId).toBe('nit-warangal')
    expect(s.distanceKm).toBeGreaterThan(0.5)
    expect(s.distanceKm).toBeLessThan(1.5)
  })

  it('estimates all-in = rent + city extras', () => {
    // PG with food: + AC/laundry 0.6–1.5k + transport 0.8–1.5k + misc 2–3k (Warangal)
    expect(listingAllIn(7000, 'pg', true, warangal)).toEqual({ min: 7000 + 3400, max: 7000 + 6000 })
    // PG without food also adds food (3.5–5k)
    expect(listingAllIn(7000, 'pg', false, warangal)).toEqual({ min: 13900, max: 18000 })
    // Flat: + running total 8.8–14.5k
    expect(listingAllIn(9000, 'apartment', undefined, warangal)).toEqual({ min: 17800, max: 23500 })
    // No city data → rent only
    expect(listingAllIn(9000, 'apartment', undefined, undefined)).toEqual({ min: 9000, max: 9000 })
  })

  it('rejects empty titles and keeps only http(s) links', () => {
    expect(() => listing({ name: '  ' })).toThrow(/title/)
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('data:text/html,x')).toBeUndefined()
    expect(safeUrl(' https://example.com/x ')).toBe('https://example.com/x')
    expect(listing({ url: 'javascript:alert(1)' }).url).toBeUndefined()
  })

  it('own listings match price / food filters that OSM places cannot', () => {
    const mine = listing()
    const f: FilterState = {
      ...(structuredClone(DEFAULT_FILTERS) as FilterState),
      stayFoodOnly: true,
      stayRentMax: 8000,
    }
    const r = applyStayFilters([mine], f, { selected: warangalCampus, campuses: [] })
    expect(r.map((x) => x.stay.id)).toEqual([mine.id])
  })
})

describe('IndexedDB owner data (SPEC §13 item 8)', () => {
  it('toggles shortlist, sets note/status/checklist', async () => {
    const db = freshDb()
    expect(await toggleShortlist(db, 'college', 'nit-warangal')).toBe(true)
    expect(await toggleShortlist(db, 'college', 'nit-warangal')).toBe(false)
    await toggleShortlist(db, 'college', 'nit-trichy')
    const key = entityKey('college', 'nit-trichy')
    await setNote(db, key, 'Visit in June')
    await setStatus(db, key, 'visited')
    await setChecklist(db, key, { items: { water: true } })
    await setChecklist(db, key, { items: { wifi: false }, note: 'Wi-Fi 20 Mbps' })
    expect(await db.shortlist.count()).toBe(1)
    expect((await db.notes.get(key))?.text).toBe('Visit in June')
    expect((await db.status.get(key))?.status).toBe('visited')
    expect(await db.checklist.get(key)).toMatchObject({
      items: { water: true, wifi: false },
      note: 'Wi-Fi 20 Mbps',
    })
  })

  it('empty note and "not visited" status delete their rows', async () => {
    const db = freshDb()
    await setNote(db, 'college:x', 'a')
    await setNote(db, 'college:x', '   ')
    await setStatus(db, 'college:x', 'rejected')
    await setStatus(db, 'college:x', 'not_visited')
    expect(await db.notes.count()).toBe(0)
    expect(await db.status.count()).toBe(0)
  })

  it('export → import round-trips without data loss', async () => {
    const a = freshDb()
    const mine = listing()
    await saveListing(a, mine)
    await toggleShortlist(a, 'stay', mine.id)
    await toggleShortlist(a, 'college', 'nit-warangal')
    await setNote(a, entityKey('stay', mine.id), 'Owner: Mr Rao, "call after 6"')
    await setStatus(a, entityKey('stay', mine.id), 'shortlisted')
    await setChecklist(a, entityKey('college', 'nit-warangal'), {
      items: { safety: true },
      note: 'ok',
    })
    await savePreset(a, 'Warangal walk', 'sel=nit-warangal&stay=2')
    const exported = await exportAll(a)

    // Through JSON text, as a real file would go.
    const text = JSON.stringify(exported)
    const b = freshDb()
    await setNote(b, 'college:old', 'will be replaced')
    const summary = await importAll(b, JSON.parse(text))
    expect(summary).toEqual({
      shortlist: 2,
      notes: 1,
      status: 1,
      checklist: 1,
      presets: 1,
      myListings: 1,
    })

    const again = await exportAll(b)
    const strip = (f: ExportFile) => ({ ...f, exportedAt: '' })
    expect(strip(again)).toEqual(strip(exported))
  })

  it('rejects an invalid file and changes nothing', async () => {
    const db = freshDb()
    await setNote(db, 'college:keep', 'still here')
    await expect(importAll(db, { app: 'other', version: 1 })).rejects.toThrow(ZodError)
    await expect(
      importAll(db, {
        ...(await exportAll(freshDb())),
        myListings: [{ ...listing(), source: 'osm' }],
      }),
    ).rejects.toThrow(ZodError)
    expect((await db.notes.get('college:keep'))?.text).toBe('still here')
  })

  it('deleting a listing also deletes its shortlist mark, note, status and checklist', async () => {
    const db = freshDb()
    const mine = listing()
    const key = entityKey('stay', mine.id)
    await saveListing(db, mine)
    await toggleShortlist(db, 'stay', mine.id)
    await setNote(db, key, 'x')
    await setStatus(db, key, 'visited')
    await setChecklist(db, key, { items: { water: true } })
    await deleteListing(db, mine.id)
    const counts = await Promise.all(
      [db.listings, db.shortlist, db.notes, db.status, db.checklist].map((t) => t.count()),
    )
    expect(counts).toEqual([0, 0, 0, 0, 0])
  })

  it('refuses to save an OSM stay as an own listing', async () => {
    await expect(saveListing(freshDb(), { ...listing(), source: 'osm' })).rejects.toThrow(
      /Only own listings/,
    )
  })
})

describe('stay status filter', () => {
  it('uses the owner status (default not visited)', () => {
    const a = listing({ name: 'A' })
    const b = listing({ name: 'B' })
    const f: FilterState = {
      ...(structuredClone(DEFAULT_FILTERS) as FilterState),
      stayStatus: ['visited'],
    }
    const r = applyStayFilters([a, b], f, {
      selected: warangalCampus,
      campuses: [],
      statusOf: (id) => (id === b.id ? 'visited' : 'not_visited'),
    })
    expect(r.map((x) => x.stay.name)).toEqual(['B'])
  })
})

describe('CSV export', () => {
  it('quotes commas, quotes and newlines; blocks formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('-5')).toBe("'-5")
    expect(csvCell(undefined)).toBe('')
    expect(toCsv(['a'], [[1]])).toBe('a\r\n1\r\n')
  })

  it('exports listings and owner notes', () => {
    const mine = listing()
    expect(listingsCsv([mine]).split('\r\n')[1]).toContain('Sai Boys PG')
    const file: ExportFile = {
      app: 'mca-stay-finder',
      version: 1,
      exportedAt: 'x',
      shortlist: [
        { key: 'college:nit-warangal', kind: 'college', id: 'nit-warangal', addedAt: 'x' },
      ],
      notes: [{ key: 'college:nit-warangal', text: 'good, cheap', updatedAt: 'x' }],
      status: [],
      checklist: [
        { key: 'college:nit-warangal', items: { water: true, wifi: false }, updatedAt: 'x' },
      ],
      presets: [],
      myListings: [],
    }
    const csv = ownerNotesCsv(file, () => 'NIT Warangal')
    expect(csv.split('\r\n')[1]).toBe(
      'college,nit-warangal,NIT Warangal,true,not_visited,"good, cheap",water,',
    )
  })
})

describe('budget calculator (SPEC §6.5)', () => {
  it.each([
    ['1–2 months', { min: 1, max: 2 }],
    ['2–3 months', { min: 2, max: 3 }],
    ['1 month', { min: 1, max: 1 }],
    ['~½ month', { min: 0.5, max: 0.5 }],
    ['~½–1 month', { min: 0.5, max: 1 }],
    ['~1 month', { min: 1, max: 1 }],
    ['3–5 months', { min: 3, max: 5 }],
    ['Rare', { min: 0, max: 0 }],
  ])('parseMonths(%s)', (text, expected) => {
    expect(parseMonths(text)).toEqual(expected)
  })

  it('returns null for text it does not understand', () => {
    expect(parseMonths('depends')).toBeNull()
  })

  it('parses every deposit/brokerage text in the seed data', () => {
    for (const c of seed['cities.json'].data) {
      if (!c.costs) continue
      for (const t of [c.costs.depositMonths, c.costs.pgDepositMonths, c.costs.brokerage]) {
        expect(parseMonths(t), `${c.id}: ${t}`).not.toBeNull()
      }
    }
  })

  it('Warangal PG double, 3 years', () => {
    const b = computeBudget(warangal, 'pg_double', 3)!
    expect(b.months).toBe(36)
    expect(b.livingTotal).toEqual({ min: 8500 * 36, max: 12500 * 36 })
    expect(b.deposit).toEqual({ min: 5000, max: 6500 }) // 1 month of PG rent
    expect(b.brokerage).toEqual({ min: 0, max: 0 })
    expect(b.total).toEqual({ min: 8500 * 36 + 5000, max: 12500 * 36 + 6500 })
  })

  it('Warangal 1BHK, 2 years, with furnishing', () => {
    const b = computeBudget(warangal, 'flat_1bhk', 2, 40000)!
    // all-in 14.8–23.5k × 24; deposit 1–2 × rent 6–9k; brokerage "Rare" = 0
    expect(b.total).toEqual({ min: 14800 * 24 + 6000 + 40000, max: 23500 * 24 + 18000 + 40000 })
  })

  it('returns null for a city with no cost data', () => {
    const diu = seed['cities.json'].data.find((c) => c.id === 'diu')!
    expect(computeBudget(diu, 'pg_double', 2)).toBeNull()
  })
})
