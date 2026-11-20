import { ConfidenceBadge } from '@/components/common/SourcedValue'
import { RentalLinks } from '@/components/common/RentalLinks'
import { OwnerControls } from '@/components/tools/OwnerControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteListing, getDb } from '@/store/db'
import { useAppStore } from '@/store/useAppStore'
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
  const openListingForm = useAppStore((st) => st.openListingForm)
  const selectStay = useAppStore((st) => st.selectStay)
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
                  confidence: 'estimate',
                  source:
                    s.rent !== undefined
                      ? 'Your rent + the city’s monthly running costs (SPEC §11.4/11.5 estimates)'
                      : 'SPEC §11 locality/city range for this stay type — not a quoted price',
                }}
              />
            </span>
          ) : (
            'Unknown'
          )}
        </dd>
        {s.rent !== undefined && (
          <>
            <dt className="text-muted-foreground">Rent (yours)</dt>
            <dd className="text-right">
              ₹{s.rent.toLocaleString('en-IN')}
              {s.deposit !== undefined && ` · deposit ₹${s.deposit.toLocaleString('en-IN')}`}
            </dd>
          </>
        )}
        {s.source === 'mine' &&
          (s.sharing || s.food !== undefined || s.ac !== undefined || s.furnished) && (
            <>
              <dt className="text-muted-foreground">Details</dt>
              <dd className="text-right">
                {[
                  s.sharing,
                  s.food === true ? 'food incl.' : s.food === false ? 'no food' : null,
                  s.ac === true ? 'AC' : s.ac === false ? 'non-AC' : null,
                  s.furnished &&
                    { none: 'unfurnished', semi: 'semi-furnished', full: 'furnished' }[s.furnished],
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            </>
          )}
        {s.phone && (
          <>
            <dt className="text-muted-foreground">Phone{s.source === 'osm' ? ' (OSM)' : ''}</dt>
            <dd className="text-right">{s.phone}</dd>
          </>
        )}
      </dl>
      {s.photoUrl && (
        <a
          href={s.photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 block text-[11px] underline"
        >
          Photo (opens in new tab)
        </a>
      )}

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
      {s.source === 'mine' && (
        <div className="mt-2 flex gap-1">
          <Button size="xs" variant="outline" onClick={() => openListingForm({ edit: s })}>
            Edit listing
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="text-destructive"
            onClick={() => {
              if (
                window.confirm(
                  `Delete "${s.name}" and its notes? This cannot be undone (export first to keep a copy).`,
                )
              ) {
                void deleteListing(getDb(), s.id).then(() => selectStay(null))
              }
            }}
          >
            Delete
          </Button>
        </div>
      )}
      <OwnerControls kind="stay" id={s.id} name={s.name} />
    </div>
  )
}
