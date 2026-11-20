import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ConfidenceBadge } from '@/components/common/SourcedValue'
import { Button } from '@/components/ui/button'
import {
  COST_PARTS,
  SERIES_COLORS,
  aqiBars,
  costBreakdown,
  radarData,
  type CostKind,
} from '@/lib/charts'
import { inrK } from '@/lib/format'
import { naqiBand } from '@/lib/naqi'
import { useAppStore, type Results } from '@/store/useAppStore'

const PART_LABEL: Record<(typeof COST_PARTS)[number], string> = {
  rent: 'Rent',
  food: 'Food',
  utilities: 'Utilities',
  transport: 'Transport',
  misc: 'Misc',
}

const axisTick = { fontSize: 10, fill: 'currentColor' }
const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    fontSize: 11,
  },
}

function ChartCard({
  title,
  source,
  children,
  table,
}: {
  title: string
  source: ReactNode
  children: ReactNode
  table: ReactNode
}) {
  return (
    <section className="space-y-1 rounded-md border p-2" aria-label={title}>
      <h3 className="text-xs font-semibold">{title}</h3>
      {children}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{source}</div>
      {/* Text alternative for screen readers and exact numbers (SPEC §12 accessibility). */}
      <details className="text-[11px]">
        <summary className="cursor-pointer text-muted-foreground">Data table</summary>
        <div className="mt-1 max-h-48 overflow-auto">{table}</div>
      </details>
    </section>
  )
}

/** Charts tab (SPEC §6.4): cost breakdown, AQI annual vs live, score radar. */
export function ChartsPanel({ results }: { results: Results }) {
  const [kind, setKind] = useState<CostKind>('pg_double')
  const live = useAppStore((s) => s.live.result?.data?.byCity ?? null)
  const cities = results.visibleCities.filter((c) => !c.excluded)
  const costs = useMemo(() => costBreakdown(cities, kind), [cities, kind])
  const aqi = useMemo(() => aqiBars(cities, live), [cities, live])

  const compareIds = useAppStore((s) => s.compareIds)
  const radarSeries = useMemo(() => {
    const ids = compareIds.length
      ? compareIds
      : results.selected
        ? [results.selected.college.id]
        : []
    return ids
      .map((id) => results.rows.find((r) => r.college.id === id))
      .filter((r) => r !== undefined)
      .map((r) => ({ name: r.college.name.replace(' (backup)', ''), scores: r.scores }))
  }, [compareIds, results])
  const radar = radarData(radarSeries)
  const scoreMode = useAppStore((s) => s.scoreMode)

  if (cities.length === 0) {
    return <p className="p-2 text-xs text-muted-foreground">No cities match the filters.</p>
  }

  return (
    <div className="h-full space-y-3 overflow-y-auto p-1 text-xs">
      <ChartCard
        title={`Monthly cost by city — ${kind === 'pg_double' ? 'PG double (food incl.)' : '1BHK flat'}`}
        source={
          <>
            Midpoints of SPEC §11.3–11.5 estimates (₹/month)
            <ConfidenceBadge
              sourced={{
                confidence: 'estimate',
                source: 'SPEC §11 cost tables — typical 2026 market rates, not quotes',
                asOf: '2026-11',
              }}
            />
          </>
        }
        table={
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th>City</th>
                {COST_PARTS.map((p) => (
                  <th key={p} className="text-right">
                    {PART_LABEL[p]}
                  </th>
                ))}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((r) => (
                <tr key={r.cityId}>
                  <td>{r.city}</td>
                  {COST_PARTS.map((p) => (
                    <td key={p} className="text-right tabular-nums">
                      {inrK(r[p])}
                    </td>
                  ))}
                  <td className="text-right font-medium tabular-nums">{inrK(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="flex gap-1" role="group" aria-label="Stay type for the cost chart">
          {(['pg_double', 'flat_1bhk'] as const).map((k) => (
            <Button
              key={k}
              size="xs"
              variant={kind === k ? 'default' : 'outline'}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k === 'pg_double' ? 'PG double' : '1BHK flat'}
            </Button>
          ))}
        </div>
        <div style={{ height: costs.length * 22 + 60 }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={costs}
              layout="vertical"
              margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} strokeOpacity={0.2} />
              <XAxis type="number" tick={axisTick} tickFormatter={(v: number) => inrK(v)} />
              <YAxis type="category" dataKey="city" width={78} tick={axisTick} interval={0} />
              <Tooltip {...tooltipStyle} formatter={(v) => `₹${inrK(Number(v))}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {COST_PARTS.filter((p) => kind === 'flat_1bhk' || p !== 'food').map((p, i) => (
                <Bar
                  key={p}
                  dataKey={p}
                  name={PART_LABEL[p]}
                  stackId="cost"
                  fill={SERIES_COLORS[i]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Air quality by city (Indian NAQI, lower is better)"
        source={
          <>
            Annual: CPCB 2025 / estimates · Live: Open-Meteo CAMS model, last 24 h
            <ConfidenceBadge
              sourced={{
                confidence: 'official',
                source:
                  'Annual: CPCB daily bulletins 2025 (some cities are estimates, marked ~). Live: modelled.',
                asOf: '2025 / today',
              }}
            />
          </>
        }
        table={
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th>City</th>
                <th className="text-right">Annual</th>
                <th className="text-right">Live 24 h</th>
              </tr>
            </thead>
            <tbody>
              {aqi.map((r) => (
                <tr key={r.cityId}>
                  <td>{r.city}</td>
                  <td className="text-right tabular-nums">
                    {r.annual === null
                      ? '–'
                      : `${r.estimate ? '~' : ''}${r.annual} (${naqiBand(r.annual)})`}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.live === null ? '–' : `${r.live} (${naqiBand(r.live)})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div style={{ height: aqi.length * 26 + 60 }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={aqi}
              layout="vertical"
              margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} strokeOpacity={0.2} />
              <XAxis type="number" tick={axisTick} domain={[0, 'dataMax']} />
              <YAxis type="category" dataKey="city" width={78} tick={axisTick} interval={0} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="annual"
                name="Annual"
                fill={SERIES_COLORS[0]}
                isAnimationActive={false}
              />
              {live && (
                <Bar
                  dataKey="live"
                  name="Live 24 h"
                  fill={SERIES_COLORS[2]}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Monthly AQI trend: no monthly data in the seed yet (SPEC §6.4 "if data").
        </p>
      </ChartCard>

      <ChartCard
        title={
          radarSeries.length > 1
            ? 'Score profile — compared colleges'
            : 'Score profile — selected college'
        }
        source={
          <>
            Sub-scores 0–10 (
            {scoreMode === 'seed' ? 'research seed, SPEC §11.1' : 'computed, SPEC §10'})
            <ConfidenceBadge
              sourced={{
                confidence: 'estimate',
                source:
                  scoreMode === 'seed'
                    ? 'Seed scores from research (SPEC §11.1)'
                    : 'Computed from the data (SPEC §10), relative to visible colleges',
              }}
            />
          </>
        }
        table={
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th>Axis</th>
                {radarSeries.map((s) => (
                  <th key={s.name} className="text-right">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {radar.map((row) => (
                <tr key={String(row.axis)}>
                  <td>{row.axis}</td>
                  {radarSeries.map((s) => (
                    <td key={s.name} className="text-right tabular-nums">
                      {row[s.name] ?? '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        {radarSeries.length === 0 ? (
          <p className="text-muted-foreground">Select a college, or add colleges to Compare.</p>
        ) : (
          <div className="h-56" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid strokeOpacity={0.3} />
                <PolarAngleAxis dataKey="axis" tick={axisTick} />
                <PolarRadiusAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 8, fill: 'currentColor' }}
                  tickCount={6}
                />
                {radarSeries.map((s, i) => (
                  <Radar
                    key={s.name}
                    name={s.name}
                    dataKey={s.name}
                    stroke={SERIES_COLORS[i]}
                    fill={SERIES_COLORS[i]}
                    fillOpacity={0.2}
                    isAnimationActive={false}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Tooltip {...tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
