/**
 * Coordinates verified by scripts/geocode.ts (Nominatim). Keys: "college:<id>", "city:<id>",
 * "locality:<id>". seed.ts replaces the approximate seed coordinates with these.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type VerifiedCoords = Record<
  string,
  { lat: number; lng: number; osm: string; query: string; deltaKm: number }
>

export const VERIFIED_COORDS_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'coords-verified.json',
)

export function loadVerifiedCoords(): VerifiedCoords {
  return existsSync(VERIFIED_COORDS_FILE)
    ? (JSON.parse(readFileSync(VERIFIED_COORDS_FILE, 'utf8')) as VerifiedCoords)
    : {}
}
