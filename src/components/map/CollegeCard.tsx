import type { ReactNode } from 'react'
import { ConfidenceBadge, SourcedValue } from '@/components/common/SourcedValue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatInrRange } from '@/lib/format'
import type { CollegeMarkerModel } from '@/lib/mapData'
import { naqiBand } from '@/lib/naqi'
import { SCORE_BAND_STYLE, formatScore } from '@/lib/scoring'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </>
  )
}

/** College popup / side card (SPEC §6.3). Radar chart comes in Phase 7. */
export function CollegeCard({ model }: { model: CollegeMarkerModel }) {
  const { college: c, city, score, band } = model
  const s = c.defaultScores
  const aqi = city?.annualAQI
  return (
    <div className="max-h-[60vh] w-72 overflow-y-auto text-xs text-foreground">
      <div className="mb-1 flex items-start justify-between gap-2 pr-4">
        <h3 className="text-sm leading-tight font-semibold">{c.name}</h3>
        <Badge variant={c.type === 'VIT' ? 'outline' : 'secondary'} className="shrink-0">
          {c.type === 'VIT' ? 'VIT · backup' : c.type}
        </Badge>
      </div>
      <p className="mb-2 text-muted-foreground">
        {city ? `${city.name}, ${city.state}` : c.cityId} · {c.entrance}
      </p>

      <div className="mb-2 flex items-center gap-2 rounded-md bg-muted p-2">
        <span
          className="flex size-9 items-center justify-center rounded-full text-sm font-bold"
          style={{
            backgroundColor: SCORE_BAND_STYLE[band].color,
            color: SCORE_BAND_STYLE[band].text,
          }}
        >
          {formatScore(score)}
        </span>
        <div>
          <p className="font-semibold">{c.verdict}</p>
          <p className="text-muted-foreground">
            {s
              ? `P ${s.placement} · A ${s.air} · C ${s.cost} · L ${s.living} (seed, weights 40/25/20/15)`
              : 'Not enough data to score'}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <Row label="Avg package">
          <SourcedValue sourced={c.avgPackageLPA} format={(v) => `${v} LPA`} />
        </Row>
        {c.medianPackageLPA && (
          <Row label="Median">
            <SourcedValue sourced={c.medianPackageLPA} format={(v) => `${v} LPA`} />
          </Row>
        )}
        {c.highestPackageLPA && (
          <Row label="Highest">
            <SourcedValue sourced={c.highestPackageLPA} format={(v) => `${v} LPA`} />
          </Row>
        )}
        {c.placementRatePct && (
          <Row label="Placed">
            <SourcedValue sourced={c.placementRatePct} format={(v) => `${v}%`} />
          </Row>
        )}
        <Row label="Seats">
          <SourcedValue sourced={c.seats} />
        </Row>
        <Row label="Duration">
          <SourcedValue sourced={c.durationYears} format={(v) => `${v} years`} />
        </Row>
        <Row label="Campus hostel">{c.campusHostel ? 'Yes (backup)' : 'No'}</Row>
        <Row label="City AQI (annual)">
          {aqi ? (
            <SourcedValue
              sourced={aqi}
              format={(v) => `${Math.round(v)} · ${naqiBand(Math.round(v))}`}
            />
          ) : (
            '–'
          )}
        </Row>
        <Row label="PG double all-in">
          {city?.costs ? (
            <span className="inline-flex items-center gap-1">
              {formatInrRange(city.costs.pgDoubleAllIn)}
              <ConfidenceBadge sourced={city.costs} />
            </span>
          ) : (
            'No data'
          )}
        </Row>
      </dl>

      {(c.exitOptionNote || c.recruitersNote || c.notes) && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
          {c.exitOptionNote && <li>{c.exitOptionNote}</li>}
          {c.recruitersNote && <li>Recruiters: {c.recruitersNote}</li>}
          {c.notes && <li>{c.notes}</li>}
        </ul>
      )}

      <Button size="sm" variant="outline" className="mt-2 w-full" disabled title="Comes in Phase 4">
        Show stays nearby
      </Button>
    </div>
  )
}
