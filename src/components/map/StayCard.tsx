import { ConfidenceBadge } from '@/components/common/SourcedValue'
import { RentalLinks } from '@/components/common/RentalLinks'
import { Badge } from '@/components/ui/badge'
import { osmUrl } from '@/lib/deeplinks'
import { formatInrRange } from '@/lib/format'
import { shortArea, stayArea } from '@/lib/mapData'
import {
  STAY_TYPE_COLOR,
  STAY_TYPE_LABEL,
  STAY_TYPE_SYMBOL,
  commuteMinutes,
  roadKm,
  stayAllIn,
  walkMinutes,
  type StayResult,
} from '@/lib/stays'
import type { City, College, Locality } from '@/types/domain'

/** Stay popup (SPEC §6.3). Shortlist / notes / status arrive in Phase 5. */
export function StayCard({
  row,
  campus,
  city,
  localities,
}: {
  row: StayResult
  campus: College | undefined
  city: City | undefined
  localities: readonly Locality[]
}) {
  const { stay: s, distanceKm } = row
  const allIn = stayAllIn(s)
  const area = stayArea(s, localities, city)
  const road = roadKm(distanceKm)
  return (
    <div className="max-h-[60vh] w-64 overflow-y-auto text-xs text-foreground">
      <div className="mb-1 flex items-start gap-2 pr-4">
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: STAY_TYPE_COLOR[s.type] }}
        >
          {STAY_TYPE_SYMBOL[s.type]}
        </span>
        <div>
          <h3 className="text-sm leading-tight font-semibold">{s.name}</h3>
          <p className="text-muted-foreground">
            {STAY_TYPE_LABEL[s.type]}
            {s.gender &&
              s.gender !== 'any' &&
              ` · ${s.gender === 'coliving' ? 'co-living' : s.gender}`}
            {area && ` · ${area}`}
          </p>
        </div>
      </div>

      <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Distance</dt>
        <dd className="text-right">
          {distanceKm.toFixed(1)} km to {campus ? shortArea(campus.name) : 'campus'}
        </dd>
        <dt className="text-muted-foreground">Commute (est.)</dt>
        <dd className="text-right">
          {road <= 2.5 ? `${walkMinutes(distanceKm)} min walk · ` : ''}
          {commuteMinutes(distanceKm)} min by auto/bus
        </dd>
        <dt className="text-muted-foreground">All-in / month</dt>
        <dd className="text-right">
          {allIn ? (
            <span className="inline-flex items-center gap-1">
              {formatInrRange(allIn)}
              <ConfidenceBadge
                sourced={{
                  confidence: s.rent !== undefined ? 'official' : 'estimate',
                  source:
                    s.rent !== undefined
                      ? 'Your listing'
                      : 'SPEC §11 locality/city range for this stay type — not a quoted price',
                }}
              />
            </span>
          ) : (
            'Unknown'
          )}
        </dd>
        {s.phone && (
          <>
            <dt className="text-muted-foreground">Phone (OSM)</dt>
            <dd className="text-right">{s.phone}</dd>
          </>
        )}
      </dl>

      <RentalLinks
        area={area}
        city={city ? city.name.replace(/\s*\(.*\)$/, '') : area}
        type={s.type}
      />

      <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="h-4 px-1 text-[9px]">
          {s.source === 'osm' ? 'OSM' : 'My listing'}
        </Badge>
        {s.osmId && (
          <a href={osmUrl(s.osmId)} target="_blank" rel="noopener noreferrer" className="underline">
            View on OpenStreetMap
          </a>
        )}
        {s.url && (
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
            Website
          </a>
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        ★ Shortlist, notes and visit status come in Phase 5.
      </p>
    </div>
  )
}
