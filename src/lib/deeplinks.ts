/**
 * Rental-site deep links (SPEC §9). Plain links that open a search in a new tab.
 * We never fetch or parse these sites.
 *
 * SPEC asks to use each site's own search URL only if its pattern can be confirmed. Confirming
 * would mean fetching the sites, which SPEC also forbids, so every link uses the SPEC fallback:
 * a Google search limited to that site (`site:`), plus one open Google search.
 */
import type { StayType } from '@/types/domain'

export const RENTAL_SITES = [
  { id: 'nobroker', label: 'NoBroker', domain: 'nobroker.in' },
  { id: 'magicbricks', label: 'MagicBricks', domain: 'magicbricks.com' },
  { id: '99acres', label: '99acres', domain: '99acres.com' },
  { id: 'housing', label: 'Housing.com', domain: 'housing.com' },
] as const

/** Search words per stay type. */
export const searchWords = (type: StayType | 'any'): string => {
  switch (type) {
    case 'apartment':
      return '1BHK flat for rent'
    case 'bungalow':
      return 'independent house for rent'
    case 'guest_house':
      return 'guest house'
    case 'hostel':
      return 'private hostel'
    case 'campus_hostel':
      return 'hostel'
    default:
      return 'PG'
  }
}

const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`

export type RentalLink = { id: string; label: string; url: string }

/** Links for one area. `area` is a locality name or the city name. */
export function rentalLinks(
  area: string,
  city: string,
  type: StayType | 'any' = 'pg',
): RentalLink[] {
  const words = searchWords(type)
  const place = area && area !== city ? `${area} ${city}` : city
  return [
    ...RENTAL_SITES.map((s) => ({
      id: s.id,
      label: s.label,
      url: google(`${words} ${place} site:${s.domain}`),
    })),
    { id: 'google', label: 'Google', url: google(`${words} near ${place}`) },
  ]
}

/** OpenStreetMap page for a mapped place ("node/123"). */
export const osmUrl = (osmId: string) => `https://www.openstreetmap.org/${osmId}`
