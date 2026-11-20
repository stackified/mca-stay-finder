import { useMemo, useState } from 'react'
import { RentalLinks } from '@/components/common/RentalLinks'
import { ShortlistStar } from '@/components/tools/OwnerControls'
import { useStatusMap } from '@/store/useOwnerData'
import { VISIT_STATUS_LABEL, entityKey } from '@/types/userData'
import { Button } from '@/components/ui/button'
import { formatInrRange } from '@/lib/format'
import { FIT_LABEL, shortArea } from '@/lib/mapData'
import {
  ALL_STAY_TYPES,
  FEW_STAYS,
  STAY_TYPE_COLOR,
  STAY_TYPE_LABEL,
  STAY_TYPE_SYMBOL,
  commuteMinutes,
  stayAllIn,
} from '@/lib/stays'
import { cn } from '@/lib/utils'
import { useAppStore, type Results } from '@/store/useAppStore'

type SortBy = 'distance' | 'cost'

/** Stays tab (SPEC §6.4): stays near the selected campus, by distance or cost. */
export function StayList({ results }: { results: Results }) {
  const [sortBy, setSortBy] = useState<SortBy>('distance')
  const data = useAppStore((s) => s.data)
  const filters = useAppStore((s) => s.filters)
  const setFilters = useAppStore((s) => s.setFilters)
  const selectedStayId = useAppStore((s) => s.selectedStayId)
  const selectStay = useAppStore((s) => s.selectStay)
  const openListingForm = useAppStore((s) => s.openListingForm)
  const statusMap = useStatusMap()
  const selected = results.selected

  const rows = useMemo(() => {
    const r = [...results.stays]
    if (sortBy === 'cost') {
      r.sort((a, b) => (stayAllIn(a.stay)?.min ?? Infinity) - (stayAllIn(b.stay)?.min ?? Infinity))
    }
    return r
  }, [results.stays, sortBy])

  if (!data?.stays) {
    return (
      <p className="p-2 text-xs text-muted-foreground">
        No OSM stay data loaded (run npm run data:osm).
      </p>
    )
  }
  if (!selected) {
    return (
      <div className="space-y-2 p-2 text-xs">
        <p>
          <span className="font-semibold">{results.stays.length}</span> stays lie within{' '}
          {filters.stayMaxDistanceKm} km of a visible campus.
        </p>
        <p className="text-muted-foreground">
          Select a college on the map or in the Ranked tab to draw its ring and list its stays.
        </p>
      </div>
    )
  }

  const city = data.cities.data.find((c) => c.id === selected.college.cityId)
  const cityName = city?.name.replace(/\s*\(.*\)$/, '') ?? ''
  const localities = data.localities.data.filter((l) => l.collegeId === selected.college.id)
  const few = rows.length < FEW_STAYS

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-xs">
      <div className="space-y-1.5 border-b px-1 pb-2">
        <p>
          <span className="font-semibold">{rows.length}</span> stays within{' '}
          {filters.stayMaxDistanceKm} km of {selected.college.name}
        </p>
        <div className="flex items-center gap-1" role="group" aria-label="Sort stays">
          <span className="text-muted-foreground">Sort:</span>
          {(['distance', 'cost'] as const).map((k) => (
            <Button
              key={k}
              size="xs"
              variant={sortBy === k ? 'default' : 'outline'}
              aria-pressed={sortBy === k}
              onClick={() => setSortBy(k)}
            >
              {k === 'distance' ? 'Distance' : 'All-in cost'}
            </Button>
          ))}
        </div>
        <RentalLinks area={cityName} city={cityName} type="pg" />
        {localities.length > 0 && (
          <details className="text-[11px]">
            <summary className="cursor-pointer text-muted-foreground">
              Localities near campus (SPEC §11.6)
            </summary>
            <ul className="mt-1 space-y-1">
              {localities.map((l) => (
                <li key={l.id}>
                  <span className="font-medium">{l.name}</span> · {l.distanceKm.min}–
                  {l.distanceKm.max} km · {FIT_LABEL[l.fit]} · PG {formatInrRange(l.pgDoubleAllIn)}{' '}
                  · 1BHK {formatInrRange(l.flat1bhkAllIn)}
                  <div className="text-muted-foreground">{l.vibe}</div>
                  <RentalLinks area={shortArea(l.name)} city={cityName} type="pg" compact />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {few && (
        <div
          role="status"
          className="mx-1 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-950 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="font-semibold">Few mapped places here.</p>
          <p>
            OpenStreetMap does not map most PGs in India. Add your own listings or search the rental
            sites above.
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Button
              size="xs"
              variant="outline"
              onClick={() => openListingForm({ collegeId: selected.college.id })}
            >
              + Add my listing
            </Button>
            {filters.stayMaxDistanceKm < 10 && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => setFilters({ stayMaxDistanceKm: 10 })}
              >
                Widen to 10 km
              </Button>
            )}
            {filters.stayTypes.length < ALL_STAY_TYPES.length && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => setFilters({ stayTypes: [...ALL_STAY_TYPES] })}
              >
                Show all stay types
              </Button>
            )}
          </div>
        </div>
      )}

      <ul className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label="Stays">
        {rows.map(({ stay: s, distanceKm }) => (
          <li key={s.id} className="flex items-start">
            <ShortlistStar kind="stay" id={s.id} name={s.name} className="mt-1" />
            <button
              type="button"
              onClick={() => selectStay(s.id)}
              aria-current={s.id === selectedStayId}
              className={cn(
                'flex w-full items-start gap-2 px-1 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600',
                s.id === selectedStayId && 'bg-blue-50 dark:bg-blue-950',
              )}
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: STAY_TYPE_COLOR[s.type] }}
              >
                {STAY_TYPE_SYMBOL[s.type]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {s.name}
                  {s.source === 'mine' && (
                    <span className="ml-1 rounded border px-1 text-[9px] font-normal">mine</span>
                  )}
                  {(statusMap.get(entityKey('stay', s.id)) ?? 'not_visited') !== 'not_visited' && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      · {VISIT_STATUS_LABEL[statusMap.get(entityKey('stay', s.id))!]}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {STAY_TYPE_LABEL[s.type]} · {distanceKm.toFixed(1)} km · ~
                  {commuteMinutes(distanceKm)} min
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                {formatInrRange(stayAllIn(s))}
                <span className="block text-[10px] text-muted-foreground">est.</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
