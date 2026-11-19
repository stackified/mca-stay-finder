/**
 * geocode.ts — SPEC §9. Checks campus, city and locality coordinates with Nominatim.
 *
 *   npm run data:geocode            query (cached), print report, write scripts/geocode-report.md
 *   npm run data:geocode -- --apply also write scripts/seed/coords-verified.json (used by seed.ts)
 *
 * Nominatim usage policy: max 1 request/second, identifying User-Agent, cache results.
 * The User-Agent is generic on purpose (no personal data). Every answer is cached in
 * scripts/geocode-cache.json, so re-runs make no requests.
 *
 * A result is accepted only if it is plausible:
 *   - campus:   OSM object is a university/college/educational institution, ≤ 25 km from the seed point
 *   - locality: OSM place object (suburb, neighbourhood, …), ≤ 5 km from the seed point (12 km for
 *               "too-far" city localities) and within
 *               the SPEC §11.6 distance band from its campus (+3 km)
 *   - city:     city/town object (or an administrative centroid ≤ 3 km away), ≤ 30 km from the seed
 * Everything else goes to "needs review" and the seed coordinate is kept.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { haversineKm } from '../src/lib/geo.ts'
import { CITIES } from './seed/cities.ts'
import { COLLEGES } from './seed/colleges.ts'
import { LOCALITIES } from './seed/localities.ts'
import { VERIFIED_COORDS_FILE, type VerifiedCoords } from './seed/verified.ts'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = path.join(DIR, 'geocode-cache.json')
const REPORT_FILE = path.join(DIR, 'geocode-report.md')
const USER_AGENT = 'mca-stay-finder/1.0 (personal)'
const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

type NominatimHit = {
  lat: string
  lon: string
  osm_type: string
  osm_id: number
  category?: string
  class?: string
  type: string
  name?: string
  display_name: string
}

type Cache = Record<string, NominatimHit[]>

/** Search strings per campus, tried in order until one gives a plausible hit. */
const CAMPUS_QUERIES: Record<string, string[]> = {
  'nit-warangal': ['National Institute of Technology Warangal', 'NIT Warangal'],
  'nit-trichy': ['National Institute of Technology Tiruchirappalli', 'NIT Trichy'],
  'mnnit-allahabad': ['Motilal Nehru National Institute of Technology', 'MNNIT Allahabad'],
  'nit-jamshedpur': ['National Institute of Technology Jamshedpur', 'NIT Jamshedpur'],
  'manit-bhopal': ['Maulana Azad National Institute of Technology', 'MANIT Bhopal'],
  'nit-raipur': ['National Institute of Technology Raipur', 'NIT Raipur'],
  'nit-agartala': ['National Institute of Technology Agartala', 'NIT Agartala'],
  'nit-kurukshetra': ['National Institute of Technology Kurukshetra', 'NIT Kurukshetra'],
  'nit-meghalaya': ['National Institute of Technology Meghalaya', 'NIT Meghalaya'],
  'nit-patna': ['National Institute of Technology Patna', 'NIT Patna'],
  'nit-delhi': ['National Institute of Technology Delhi', 'NIT Delhi'],
  'iiit-bhopal': ['Indian Institute of Information Technology Bhopal', 'IIIT Bhopal'],
  'iiit-vadodara-diu': [
    'IIIT Vadodara International Campus Diu',
    'Indian Institute of Information Technology Vadodara Diu',
  ],
  'iiit-vadodara-gandhinagar': [
    'Indian Institute of Information Technology Vadodara',
    'IIIT Vadodara Gandhinagar',
  ],
  'vit-vellore': ['Vellore Institute of Technology', 'VIT University Vellore'],
  'vit-chennai': ['Vellore Institute of Technology Chennai', 'VIT Chennai'],
  'vit-bhopal': ['VIT Bhopal University', 'Vellore Institute of Technology Bhopal'],
}

const CITY_QUERY: Record<string, string> = {
  delhi: 'Delhi',
  kurukshetra: 'Kurukshetra, Haryana',
  prayagraj: 'Prayagraj, Uttar Pradesh',
  bhopal: 'Bhopal, Madhya Pradesh',
  raipur: 'Raipur, Chhattisgarh',
  patna: 'Patna, Bihar',
  jamshedpur: 'Jamshedpur, Jharkhand',
  agartala: 'Agartala, Tripura',
  shillong: 'Shillong, Meghalaya',
  warangal: 'Warangal, Telangana',
  trichy: 'Tiruchirappalli, Tamil Nadu',
  vellore: 'Vellore, Tamil Nadu',
  'chennai-kelambakkam': 'Kelambakkam, Tamil Nadu',
  sehore: 'Sehore, Madhya Pradesh',
  gandhinagar: 'Gandhinagar, Gujarat',
  diu: 'Diu',
}

const COLLEGE_CITY: Record<string, string> = {
  'nit-warangal': 'Warangal',
  'nit-trichy': 'Tiruchirappalli',
  'mnnit-allahabad': 'Prayagraj',
  'nit-jamshedpur': 'Jamshedpur',
  'manit-bhopal': 'Bhopal',
  'nit-raipur': 'Raipur',
}

/** "Thiruverumbur / BHEL area" → ["Thiruverumbur, Tiruchirappalli", "BHEL area, Tiruchirappalli"]. */
function localityQueries(name: string, collegeId: string): string[] {
  const city = COLLEGE_CITY[collegeId] ?? ''
  const cleaned = name.replace(/\(.*?\)/g, (m) => ` / ${m.slice(1, -1)}`)
  return cleaned
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p && !/^(city|NIT gate)$/i.test(p))
    .map((p) => `${p}, ${city}`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let lastRequest = 0

async function search(q: string, cache: Cache): Promise<NominatimHit[]> {
  if (cache[q]) return cache[q]
  const wait = lastRequest + 1100 - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()
  const url = `${ENDPOINT}?${new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'in', limit: '5' })}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status} for "${q}"`)
  const hits = (await res.json()) as NominatimHit[]
  cache[q] = hits
  writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`)
  return hits
}

type Row = {
  key: string
  label: string
  seed: { lat: number; lng: number }
  hit?: NominatimHit
  query?: string
  deltaKm?: number
  status: 'accepted' | 'review' | 'not found'
  reason: string
}

/** Education objects only (a bus stop named "NIT Patna" is not a campus). */
const CAMPUS_TYPES = ['university', 'college', 'educational_institution']
const isCampusLike = (h: NominatimHit) => CAMPUS_TYPES.includes(h.type)

/** Place objects only (no ponds, parks, schools, airports or roads as locality centres). */
const PLACE_TYPES = [
  'suburb',
  'neighbourhood',
  'residential',
  'quarter',
  'town',
  'village',
  'hamlet',
  'locality',
  'city',
]
const CITY_TYPES = ['city', 'town', 'village']

async function main() {
  const apply = process.argv.includes('--apply')
  const cache: Cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
  const rows: Row[] = []

  const resolve = async (
    key: string,
    label: string,
    seed: { lat: number; lng: number },
    queries: string[],
    accept: (h: NominatimHit, d: number) => string | null,
  ) => {
    let best: Row | null = null
    for (const q of queries) {
      const hits = await search(q, cache)
      for (const h of hits) {
        const d = haversineKm(seed, { lat: Number(h.lat), lng: Number(h.lon) })
        const why = accept(h, d)
        const row: Row = {
          key,
          label,
          seed,
          hit: h,
          query: q,
          deltaKm: d,
          status: why === null ? 'accepted' : 'review',
          reason: why ?? 'plausible',
        }
        if (row.status === 'accepted') {
          rows.push(row)
          return
        }
        if (!best || d < (best.deltaKm ?? Infinity)) best = row
      }
    }
    rows.push(
      best ?? {
        key,
        label,
        seed,
        status: 'not found',
        reason: `no hits for: ${queries.join(' | ')}`,
      },
    )
  }

  for (const c of COLLEGES) {
    await resolve(`college:${c.id}`, c.name, c, CAMPUS_QUERIES[c.id] ?? [c.name], (h, d) =>
      !isCampusLike(h)
        ? `not a campus (${h.type})`
        : d > 25
          ? `${d.toFixed(1)} km from seed`
          : null,
    )
  }
  for (const c of CITIES) {
    // District/state centroids ("administrative") are accepted only when very close.
    await resolve(`city:${c.id}`, c.name, c, [CITY_QUERY[c.id] ?? c.name], (h, d) =>
      d > 30
        ? `${d.toFixed(1)} km from seed`
        : !CITY_TYPES.includes(h.type) && !(h.type === 'administrative' && d <= 3)
          ? `${h.type} centroid, ${d.toFixed(1)} km from seed`
          : null,
    )
  }
  const campus = (id: string) => {
    const r = rows.find((x) => x.key === `college:${id}` && x.status === 'accepted')
    return r?.hit
      ? { lat: Number(r.hit.lat), lng: Number(r.hit.lon) }
      : COLLEGES.find((c) => c.id === id)!
  }
  for (const l of LOCALITIES) {
    const camp = campus(l.collegeId)
    await resolve(`locality:${l.id}`, l.name, l, localityQueries(l.name, l.collegeId), (h, d) => {
      const toCampus = haversineKm(camp, { lat: Number(h.lat), lng: Number(h.lon) })
      if (!PLACE_TYPES.includes(h.type)) return `not a place (${h.type})`
      // Same-name places exist (an "MP Nagar" in Kolar is not MP Nagar Zone-I): limit the move.
      const maxMove = l.fit === 'too-far' ? 12 : 5
      if (d > maxMove) return `${d.toFixed(1)} km from seed (max ${maxMove})`
      // SPEC §11.6 gives a distance band per locality; allow 3 km slack.
      if (toCampus > l.distanceKm.max + 3) {
        return `${toCampus.toFixed(1)} km from campus (SPEC: ${l.distanceKm.min}–${l.distanceKm.max})`
      }
      return null
    })
  }

  // ---------- Report ----------
  const fmt = (r: Row) =>
    `| ${r.status === 'accepted' ? 'OK' : r.status === 'review' ? '**REVIEW**' : '**NOT FOUND**'} | ${r.key} | ${
      r.deltaKm === undefined ? '–' : r.deltaKm.toFixed(2)
    } | ${r.hit ? `${r.hit.type} — ${r.hit.display_name.slice(0, 80)}` : '–'} | ${r.reason} |`
  const report = [
    `# Geocode report`,
    ``,
    `Generated ${new Date().toISOString().slice(0, 10)} by scripts/geocode.ts (Nominatim, © OpenStreetMap contributors).`,
    ``,
    `Accepted: ${rows.filter((r) => r.status === 'accepted').length} · Review: ${rows.filter((r) => r.status === 'review').length} · Not found: ${rows.filter((r) => r.status === 'not found').length}`,
    ``,
    `| Status | Item | Δ km from seed | Nominatim result | Reason |`,
    `|---|---|---|---|---|`,
    ...rows.map(fmt),
    ``,
  ].join('\n')
  writeFileSync(REPORT_FILE, report)
  console.log(report)

  if (apply) {
    const out: VerifiedCoords = {}
    for (const r of rows) {
      if (r.status !== 'accepted' || !r.hit) continue
      out[r.key] = {
        lat: Number(Number(r.hit.lat).toFixed(5)),
        lng: Number(Number(r.hit.lon).toFixed(5)),
        osm: `${r.hit.osm_type}/${r.hit.osm_id}`,
        query: r.query!,
        deltaKm: Number(r.deltaKm!.toFixed(2)),
      }
    }
    writeFileSync(VERIFIED_COORDS_FILE, `${JSON.stringify(out, null, 2)}\n`)
    console.log(
      `wrote ${path.relative(process.cwd(), VERIFIED_COORDS_FILE)} (${Object.keys(out).length} entries)`,
    )
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
