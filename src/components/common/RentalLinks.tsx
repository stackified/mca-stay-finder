import { ExternalLink } from 'lucide-react'
import { rentalLinks } from '@/lib/deeplinks'
import type { StayType } from '@/types/domain'

/**
 * "Search this area on …" buttons (SPEC §6.3). Plain links in a new tab; the app never
 * fetches these sites. Each is a Google search limited to the site (see lib/deeplinks.ts).
 */
export function RentalLinks({
  area,
  city,
  type = 'pg',
  compact = false,
}: {
  area: string
  city: string
  type?: StayType | 'any'
  compact?: boolean
}) {
  const links = rentalLinks(area, city, type)
  return (
    <div>
      {!compact && (
        <p className="mb-1 text-[11px] text-muted-foreground">
          Search {area && area !== city ? `${area}, ${city}` : city} on:
        </p>
      )}
      <ul className="flex flex-wrap gap-1">
        {links.map((l) => (
          <li key={l.id}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-blue-600"
              title={`Opens a Google search limited to ${l.label} (new tab)`}
            >
              {l.label}
              <ExternalLink aria-hidden className="size-2.5 opacity-60" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
