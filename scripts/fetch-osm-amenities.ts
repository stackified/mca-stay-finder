/**
 * fetch-osm-amenities.ts — SPEC §9. Grocery, hospital/clinic, pharmacy, gym, bus stop, railway
 * station and restaurant/mess within 5 km of each campus → public/data/amenities.json.
 *
 *   npm run data:amenities             (uses cached Overpass answers when present)
 *   npm run data:amenities -- --fresh
 *   add --force to accept a result with < 50 % of the old row count
 *
 * Same Overpass client and politeness rules as fetch-osm-stays.ts. Data © OpenStreetMap contributors.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  AMENITY_KINDS,
  AmenitiesFileSchema,
  amenityKind,
  type AmenityRow,
} from '../src/lib/amenities.ts'
import { haversineKm } from '../src/lib/geo.ts'
import {
  assertNoBigDrop,
  countRows,
  overpass,
  PAUSE_MS,
  sleep,
  type OsmElement,
} from './overpass.ts'
import { buildSeed, DATA_DIR } from './seed.ts'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(DIR, '.cache', 'amenities')
const RADIUS_KM = 5

/** One spatial search per tag family, union, then classify in code with amenityKind(). */
export function amenityQuery(lat: number, lng: number, radiusM = RADIUS_KM * 1000): string {
  const a = `around:${radiusM},${lat},${lng}`
  return `[out:json][timeout:180];
(
  nwr(${a})["shop"~"^(supermarket|convenience|greengrocer|grocery|chemist)$"];
  nwr(${a})["amenity"~"^(hospital|clinic|doctors|pharmacy|bus_station|restaurant|fast_food|food_court|cafe)$"];
  nwr(${a})["healthcare"~"^(hospital|clinic|pharmacy)$"];
  nwr(${a})["leisure"="fitness_centre"];
  node(${a})["highway"="bus_stop"];
  nwr(${a})["railway"~"^(station|halt)$"];
);
out center tags;`
}

async function main() {
  const fresh = process.argv.includes('--fresh')
  mkdirSync(CACHE_DIR, { recursive: true })
  const seed = buildSeed()
  const seen = new Set<string>()
  const campuses = seed['colleges.json'].data.filter((c) => {
    const k = `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // Campuses that share a point (IIIT Bhopal / MANIT) share the amenities list.
  const sameAs = new Map<string, string>()
  for (const c of seed['colleges.json'].data) {
    const twin = campuses.find(
      (x) => x.lat.toFixed(3) === c.lat.toFixed(3) && x.lng.toFixed(3) === c.lng.toFixed(3),
    )
    if (twin && twin.id !== c.id) sameAs.set(c.id, twin.id)
  }

  const byCampus: Record<string, AmenityRow[]> = {}
  let queried = 0
  for (const c of campuses) {
    const cacheFile = path.join(CACHE_DIR, `${c.id}.json`)
    let elements: OsmElement[]
    if (!fresh && existsSync(cacheFile)) {
      elements = JSON.parse(readFileSync(cacheFile, 'utf8')) as OsmElement[]
    } else {
      if (queried > 0) await sleep(PAUSE_MS)
      elements = await overpass(amenityQuery(c.lat, c.lng))
      writeFileSync(cacheFile, JSON.stringify(elements))
      queried++
    }
    const rows: AmenityRow[] = []
    const dedupe = new Set<string>()
    for (const el of elements) {
      const kind = amenityKind(el.tags ?? {})
      const lat = el.lat ?? el.center?.lat
      const lng = el.lon ?? el.center?.lon
      if (!kind || lat === undefined || lng === undefined) continue
      if (haversineKm(c, { lat, lng }) > RADIUS_KM) continue
      const key = `${kind}:${lat.toFixed(4)},${lng.toFixed(4)}`
      if (dedupe.has(key)) continue
      dedupe.add(key)
      const name = el.tags?.name ?? el.tags?.['name:en']
      rows.push(
        name
          ? [kind, Number(lat.toFixed(5)), Number(lng.toFixed(5)), name]
          : [kind, Number(lat.toFixed(5)), Number(lng.toFixed(5))],
      )
    }
    byCampus[c.id] = rows
    const counts = Object.fromEntries(
      AMENITY_KINDS.map((k) => [k, rows.filter((r) => r[0] === k).length]),
    )
    console.log(c.id.padEnd(26), String(rows.length).padStart(5), JSON.stringify(counts))
  }
  for (const [id, twin] of sameAs) byCampus[id] = byCampus[twin] ?? []

  const file = AmenitiesFileSchema.parse({
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      generator: 'scripts/fetch-osm-amenities.ts',
      sources: ['© OpenStreetMap contributors (Overpass API), ODbL'],
      radiusKm: RADIUS_KM,
      notes: ['Coverage depends on OSM mapping; small towns may miss shops and clinics.'],
    },
    byCampus,
  })
  const total = Object.values(byCampus).reduce((s, r) => s + r.length, 0)
  const out = path.join(DATA_DIR, 'amenities.json')
  assertNoBigDrop(
    'amenities.json',
    countRows(out, (j) =>
      Object.values((j as { byCampus?: Record<string, unknown[]> }).byCampus ?? {}).reduce(
        (s, r) => s + r.length,
        0,
      ),
    ),
    total,
  )
  writeFileSync(out, `${JSON.stringify(file)}\n`)
  console.log(`wrote public/data/amenities.json: ${total} rows (${queried} Overpass queries)`)
}

// pathToFileURL works on Windows and Linux (GitHub Actions); a hand-built file:/// URL does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
