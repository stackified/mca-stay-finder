/**
 * Pure helpers for fetch-osm-stays.ts (unit-tested): OSM element → Stay.
 * Type mapping follows SPEC §9.
 */
import type { City, Locality, Range, Stay } from '../src/types/domain.ts'
import { haversineKm } from '../src/lib/geo.ts'

import type { OsmElement } from './overpass.ts'
export type { OsmElement }

/**
 * Overpass query based on SPEC §9, made lighter: ONE spatial search for named objects, then
 * in-memory tag filters. SPEC's version runs four spatial searches and also returns unnamed
 * places, which toStay() drops anyway, so the output is the same. `\b` is not supported by
 * Overpass regex, so word edges are spelled out.
 */
export function overpassQuery(lat: number, lng: number, radiusM = 10000): string {
  return `[out:json][timeout:180];
nwr(around:${radiusM},${lat},${lng})["name"]->.named;
(
  nwr.named["tourism"~"^(hostel|guest_house|apartment)$"];
  nwr.named["building"~"^(apartments|dormitory|house|bungalow|residential)$"];
  nwr.named["name"~"(^|[^a-z])(pg|paying guest|hostel|boys|girls|residency|co-?living|apartments?|enclave|villa)([^a-z]|$)",i];
);
out center tags;`
}

const has = (re: RegExp, s: string | undefined) => !!s && re.test(s)

/** Objects with these keys are not places to stay (roads, shops, offices, areas …). */
const NOT_STAY_KEYS = [
  'highway',
  'railway',
  'shop',
  'office',
  'leisure',
  'man_made',
  'natural',
  'waterway',
  'public_transport',
  'historic',
  'power',
  'boundary',
  'craft',
  'healthcare',
  'emergency',
  'aeroway',
  'barrier',
  'landuse',
  'place',
]
const NOT_STAY_AMENITY =
  /^(school|college|university|kindergarten|place_of_worship|hospital|clinic|doctors|bank|atm|restaurant|cafe|fast_food|fuel|police|post_office|townhall|bus_station|parking|library|community_centre|marketplace|toilets|pharmacy|cinema|courthouse)$/
/** Names that describe something else (a school, an office, a road, staff housing …). */
const NOT_STAY_NAME =
  /(^|[^a-z])(school|vidyalaya|college|office|route|road|street|marg|temple|mandir|church|masjid|mosque|hospital|clinic|bank|mess|canteen|gate|ground|stadium|park|quarters?|director'?s?|principal'?s?|shop|store|stores|works|welding|jewell?e?ry|showroom|traders|enterprises?|agency|agencies|garage)([^a-z]|$)/i

/**
 * False positives seen in real data (NIT Warangal): "Fatima Girls High School" (→ PG by name),
 * "Route to 1.8k Hostel" (a footpath), "Hostel Office", "Director's Bunglow" (staff housing).
 * An explicit tourism=hostel/guest_house/apartment tag always wins over the name rules.
 */
export function isNotAStay(tags: Record<string, string>): boolean {
  if (/^(hostel|guest_house|apartment)$/.test(tags.tourism ?? '')) return false
  // Housing societies are often mapped as a residential area ("Tulsi Apartments") — keep those.
  const housingArea =
    tags.landuse === 'residential' &&
    has(/apartment|residency|enclave|tower|heights|society|villa/i, tags.name)
  if (NOT_STAY_KEYS.some((k) => k in tags && !(k === 'landuse' && housingArea))) return true
  if (NOT_STAY_AMENITY.test(tags.amenity ?? '')) return true
  return has(NOT_STAY_NAME, tags.name)
}

/** SPEC §9 type mapping, plus: a named dormitory within 2 km of campus = campus hostel. */
export function stayType(tags: Record<string, string>, distanceKm: number): Stay['type'] {
  const name = tags.name ?? ''
  if (tags.building === 'dormitory' && distanceKm <= 2) return 'campus_hostel'
  if (tags.tourism === 'hostel' || has(/hostel/i, name) || tags.building === 'dormitory')
    return 'hostel'
  if (has(/(^|[^a-z])(pg|paying guest|boys|girls|co-?living)([^a-z]|$)/i, name)) return 'pg'
  if (tags.tourism === 'guest_house') return 'guest_house'
  if (
    tags.building === 'apartments' ||
    tags.tourism === 'apartment' ||
    has(/apartment|residency|enclave/i, name)
  ) {
    return 'apartment'
  }
  if (tags.building === 'house' || tags.building === 'bungalow' || has(/villa|bungalow/i, name))
    return 'bungalow'
  return 'unknown'
}

export function stayGender(name: string): Stay['gender'] | undefined {
  if (/co-?living/i.test(name)) return 'coliving'
  if (/(^|[^a-z])(girls?|ladies|women|womens)([^a-z]|$)/i.test(name)) return 'girls'
  if (/(^|[^a-z])(boys?|gents|mens)([^a-z]|$)/i.test(name)) return 'boys'
  return undefined
}

/** Raw OSM tags kept in the output (keeps the JSON small). */
const KEEP_TAGS =
  /^(name(:en)?|tourism|building|amenity|operator|addr:.*|phone|contact:.*|website|gender|rooms|beds|internet_access|description)$/

/**
 * All-in estimate by stay type: nearest SPEC §11.6 locality within 2 km if any, else the city.
 * Campus hostels get no estimate (fees vary by institute).
 */
export function allInEstimate(
  type: Stay['type'],
  point: { lat: number; lng: number },
  city: City | undefined,
  localities: readonly Locality[],
): Range | undefined {
  const near = localities
    .map((l) => ({ l, d: haversineKm(point, l) }))
    .filter((x) => x.d <= 2)
    .sort((a, b) => a.d - b.d)[0]?.l
  switch (type) {
    case 'pg':
    case 'hostel':
      return near?.pgDoubleAllIn ?? city?.costs?.pgDoubleAllIn
    case 'guest_house':
      return city?.costs?.pgSingleAllIn
    case 'apartment':
      return near?.flat1bhkAllIn ?? city?.costs?.flat1bhkAllIn
    case 'bungalow':
      return near?.bungalowAllIn ?? city?.costs?.bungalowAllIn
    default:
      return undefined
  }
}

export function toStay(
  el: OsmElement,
  campus: { id: string; lat: number; lng: number },
  city: City | undefined,
  localities: readonly Locality[],
): Stay | null {
  const tags = el.tags ?? {}
  const name = tags.name ?? tags['name:en']
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (!name || lat === undefined || lng === undefined) return null // unnamed places are not useful
  if (isNotAStay(tags)) return null
  const distanceKm = Number(haversineKm(campus, { lat, lng }).toFixed(3))
  const type = stayType(tags, distanceKm)
  const gender =
    stayGender(name) ??
    (tags.gender === 'female' ? 'girls' : tags.gender === 'male' ? 'boys' : undefined)
  const keptTags = Object.fromEntries(Object.entries(tags).filter(([k]) => KEEP_TAGS.test(k)))
  const estimate = allInEstimate(type, { lat, lng }, city, localities)
  const url = tags.website ?? tags['contact:website']
  const phone = tags.phone ?? tags['contact:phone']
  return {
    id: `osm-${el.type}-${el.id}`,
    source: 'osm',
    osmId: `${el.type}/${el.id}`,
    name,
    type,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    nearestCollegeId: campus.id,
    distanceKm,
    ...(estimate && { allInEstimate: estimate }),
    ...(gender && { gender }),
    ...(url && { url }),
    ...(phone && { phone }),
    tags: keptTags,
  }
}

/** Keeps one entry per OSM object, assigned to its nearest campus. */
export function dedupeStays(stays: readonly Stay[]): Stay[] {
  const best = new Map<string, Stay>()
  for (const s of stays) {
    const prev = best.get(s.id)
    if (!prev || s.distanceKm < prev.distanceKm) best.set(s.id, s)
  }
  return [...best.values()].sort(
    (a, b) => a.nearestCollegeId.localeCompare(b.nearestCollegeId) || a.distanceKm - b.distanceKm,
  )
}
