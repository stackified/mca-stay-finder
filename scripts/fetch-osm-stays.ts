/**
 * fetch-osm-stays.ts — SPEC §9. For each campus, asks Overpass for places to stay within 10 km,
 * normalises them to `Stay`, dedupes, and writes public/data/stays.osm.json.
 *
 *   npm run data:osm             (uses cached Overpass answers in scripts/.cache when present)
 *   npm run data:osm -- --fresh  (ignore the cache)
 *   add --force to accept a result with < 50 % of the old row count
 *
 * Rate limits: one query at a time, ≥ 5 s between queries, retries with back-off on 429/504.
 * Data © OpenStreetMap contributors (ODbL).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fileSchema, StaySchema } from '../src/types/domain.ts'
import { buildSeed, DATA_DIR } from './seed.ts'
import { dedupeStays, overpassQuery, toStay } from './osm-stays-lib.ts'
import {
  assertNoBigDrop,
  countRows,
  overpass,
  PAUSE_MS,
  sleep,
  type OsmElement,
} from './overpass.ts'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(DIR, '.cache', 'overpass')

async function main() {
  const fresh = process.argv.includes('--fresh')
  mkdirSync(CACHE_DIR, { recursive: true })
  const seed = buildSeed()
  const cities = new Map(seed['cities.json'].data.map((c) => [c.id, c]))
  const localities = seed['localities.json'].data

  // Campuses at the same point (IIIT Bhopal runs on the MANIT campus) are queried once.
  const seen = new Set<string>()
  const campuses = seed['colleges.json'].data.filter((c) => {
    const k = `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const all = []
  let queried = 0
  for (const c of campuses) {
    const cacheFile = path.join(CACHE_DIR, `${c.id}.json`)
    let elements: OsmElement[]
    if (!fresh && existsSync(cacheFile)) {
      elements = JSON.parse(readFileSync(cacheFile, 'utf8')) as OsmElement[]
    } else {
      if (queried > 0) await sleep(PAUSE_MS)
      elements = await overpass(overpassQuery(c.lat, c.lng))
      writeFileSync(cacheFile, JSON.stringify(elements))
      queried++
    }
    const stays = elements
      .map((el) =>
        toStay(
          el,
          c,
          cities.get(c.cityId),
          localities.filter((l) => l.collegeId === c.id),
        ),
      )
      .filter((s) => s !== null)
    console.log(
      `${c.id.padEnd(26)} ${String(elements.length).padStart(5)} OSM objects → ${stays.length} named stays`,
    )
    all.push(...stays)
  }

  const data = dedupeStays(all)
  const file = fileSchema(StaySchema).parse({
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      generator: 'scripts/fetch-osm-stays.ts',
      sources: ['© OpenStreetMap contributors (Overpass API), ODbL'],
      notes: [
        'OSM maps only a fraction of real PGs in India — add your own listings and use the rental-site links.',
        'allInEstimate is a SPEC §11 locality/city range by stay type, not a quoted price.',
      ],
    },
    data,
  })
  const out = path.join(DATA_DIR, 'stays.osm.json')
  assertNoBigDrop(
    'stays.osm.json',
    countRows(out, (j) => (j as { data?: unknown[] }).data?.length ?? 0),
    data.length,
  )
  writeFileSync(out, `${JSON.stringify(file)}\n`)
  const byType = data.reduce<Record<string, number>>(
    (m, s) => ((m[s.type] = (m[s.type] ?? 0) + 1), m),
    {},
  )
  console.log(
    `wrote public/data/stays.osm.json: ${data.length} stays`,
    byType,
    `(${queried} Overpass queries)`,
  )
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
