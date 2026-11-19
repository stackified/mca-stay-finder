/**
 * seed.ts — SPEC §9. Turns the seed tables (SPEC §11) into validated JSON in public/data.
 *   npm run data:seed            write the files
 *   npm run data:seed -- --check validate only, write nothing (exit 1 on error)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  CitiesFileSchema,
  CollegesFileSchema,
  LocalitiesFileSchema,
  type CitiesFile,
  type CollegesFile,
  type LocalitiesFile,
} from '../src/types/domain.ts'
import { HOME_CITY, haversineKm } from '../src/lib/geo.ts'
import { CITIES } from './seed/cities.ts'
import { COLLEGES } from './seed/colleges.ts'
import { LOCALITIES } from './seed/localities.ts'
import { SOURCES } from './seed/util.ts'
import { loadVerifiedCoords, type VerifiedCoords } from './seed/verified.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_DIR = path.join(ROOT, 'public', 'data')

/**
 * Replaces seed coordinates with Nominatim-verified ones (scripts/geocode.ts) where they exist.
 * Items without a verified point keep the seed point and a note saying it is approximate.
 */
function withVerifiedCoords<
  T extends { id: string; lat: number; lng: number; coordsNote?: string },
>(kind: 'college' | 'city' | 'locality', items: readonly T[], verified: VerifiedCoords): T[] {
  return items.map((item) => {
    const v = verified[`${kind}:${item.id}`]
    if (!v) {
      return {
        ...item,
        coordsNote: item.coordsNote ?? 'Approximate — not verified by Nominatim yet',
      }
    }
    return {
      ...item,
      lat: v.lat,
      lng: v.lng,
      coordsNote: `Verified with Nominatim (OSM ${v.osm}); moved ${v.deltaKm} km from seed`,
    }
  })
}

export type SeedFiles = {
  'cities.json': CitiesFile
  'colleges.json': CollegesFile
  'localities.json': LocalitiesFile
}

/** Throws if an id repeats or a reference points nowhere. */
function checkIntegrity(files: SeedFiles): void {
  const errors: string[] = []
  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${label}: duplicate id "${id}"`)
      seen.add(id)
    }
    return seen
  }
  const cityIds = unique(
    'cities',
    files['cities.json'].data.map((c) => c.id),
  )
  const collegeIds = unique(
    'colleges',
    files['colleges.json'].data.map((c) => c.id),
  )
  unique(
    'localities',
    files['localities.json'].data.map((l) => l.id),
  )

  for (const c of files['colleges.json'].data) {
    if (!cityIds.has(c.cityId)) errors.push(`college ${c.id}: unknown cityId "${c.cityId}"`)
  }
  for (const l of files['localities.json'].data) {
    if (!collegeIds.has(l.collegeId))
      errors.push(`locality ${l.id}: unknown collegeId "${l.collegeId}"`)
  }
  // Excluded cities must never carry a ranked college (SPEC §13: "never ranked").
  const excluded = new Set(files['cities.json'].data.filter((c) => c.excluded).map((c) => c.id))
  for (const c of files['colleges.json'].data) {
    if (excluded.has(c.cityId) && c.defaultScores !== null) {
      errors.push(`college ${c.id}: in excluded city but has defaultScores`)
    }
  }
  if (errors.length > 0) throw new Error(`Seed integrity errors:\n- ${errors.join('\n- ')}`)
}

/** Builds and validates all seed files. Pure: no disk access. */
export function buildSeed(
  generatedAt = new Date().toISOString().slice(0, 10),
  verified: VerifiedCoords = loadVerifiedCoords(),
): SeedFiles {
  // Distance from Surat is recomputed because verified city points can move.
  const cities = withVerifiedCoords('city', CITIES, verified).map((c) => ({
    ...c,
    distanceFromHomeKm: Math.round(haversineKm(HOME_CITY, c)),
  }))
  const colleges = withVerifiedCoords('college', COLLEGES, verified)
  const localities = withVerifiedCoords('locality', LOCALITIES, verified)

  const meta = (sources: string[], notes?: string[]) => ({
    generatedAt,
    generator: 'scripts/seed.ts',
    sources,
    ...(notes && { notes }),
  })

  const files: SeedFiles = {
    'cities.json': CitiesFileSchema.parse({
      meta: meta(
        [SOURCES.aqiCpcb, SOURCES.smartAir, SOURCES.costs, SOURCES.chatResearch],
        [
          'City coordinates are approximate city centres.',
          'distanceFromHomeKm is straight-line km from Surat city centre.',
        ],
      ),
      data: cities,
    }),
    'colleges.json': CollegesFileSchema.parse({
      meta: meta(
        [SOURCES.seats, SOURCES.placements, SOURCES.vit, SOURCES.coords],
        ['VIT sub-scores are derived so default weights reproduce the manual final score in SPEC.'],
      ),
      data: colleges,
    }),
    'localities.json': LocalitiesFileSchema.parse({
      meta: meta([SOURCES.costs, SOURCES.coords]),
      data: localities,
    }),
  }
  checkIntegrity(files)
  return files
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check')
  const files = buildSeed()
  if (checkOnly) {
    console.log('Seed data is valid.')
    return
  }
  await mkdir(DATA_DIR, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(DATA_DIR, name), `${JSON.stringify(content, null, 2)}\n`, 'utf8')
    console.log(`wrote public/data/${name} (${content.data.length} items)`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
