import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ConfidenceBadge, SourcedValue } from '@/components/common/SourcedValue'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { formatInrRange } from '@/lib/format'
import { naqiBand } from '@/lib/naqi'
import { SCORE_BAND_STYLE, formatScore, scoreBand } from '@/lib/scoring'
import { MAX_COMPARE } from '@/lib/urlState'
import { useAppStore, type Results } from '@/store/useAppStore'
import type { City, College, SubScores } from '@/types/domain'

type Col = {
  college: College
  city: City | undefined
  final: number | null
  rank: number | null
  scores: SubScores | null
  visible: boolean
}

const costNote = (city: City | undefined) =>
  city?.costs ? <ConfidenceBadge sourced={city.costs} /> : null

/** One comparison row: label + one cell per college. */
type Row = { label: string; cell: (c: Col) => ReactNode; group?: string }

const ROWS: Row[] = [
  {
    group: 'Score',
    label: 'Final score',
    cell: (c) => {
      const s = SCORE_BAND_STYLE[scoreBand(c.final)]
      return (
        <span
          className="rounded px-1 font-semibold"
          style={{ backgroundColor: s.color, color: s.text }}
        >
          {formatScore(c.final)}
        </span>
      )
    },
  },
  {
    label: 'Rank',
    cell: (c) => (c.rank === null ? (c.visible ? '–' : 'filtered out') : `#${c.rank}`),
  },
  { label: 'Verdict', cell: (c) => c.college.verdict },
  {
    label: 'Placement / Air / Cost / Living',
    cell: (c) =>
      c.scores
        ? `${c.scores.placement.toFixed(1)} / ${c.scores.air.toFixed(1)} / ${c.scores.cost.toFixed(1)} / ${c.scores.living.toFixed(1)}`
        : '–',
  },
  {
    group: 'College',
    label: 'Type · entrance',
    cell: (c) => `${c.college.type} · ${c.college.entrance}`,
  },
  { label: 'City', cell: (c) => c.city?.name ?? c.college.cityId },
  { label: 'Seats', cell: (c) => <SourcedValue sourced={c.college.seats} /> },
  {
    label: 'Duration',
    cell: (c) => <SourcedValue sourced={c.college.durationYears} format={(v) => `${v} yr`} />,
  },
  { label: 'Campus hostel', cell: (c) => (c.college.campusHostel ? 'Yes' : 'No') },
  {
    label: 'Fees (total)',
    cell: (c) => (
      <SourcedValue
        sourced={c.college.totalFeesINR}
        format={(v) => `₹${(v / 100000).toFixed(2)} L`}
      />
    ),
  },
  {
    group: 'Placements',
    label: 'Average package',
    cell: (c) => <SourcedValue sourced={c.college.avgPackageLPA} format={(v) => `${v} LPA`} />,
  },
  {
    label: 'Median package',
    cell: (c) => <SourcedValue sourced={c.college.medianPackageLPA} format={(v) => `${v} LPA`} />,
  },
  {
    label: 'Highest package',
    cell: (c) => <SourcedValue sourced={c.college.highestPackageLPA} format={(v) => `${v} LPA`} />,
  },
  {
    label: 'Placed',
    cell: (c) => <SourcedValue sourced={c.college.placementRatePct} format={(v) => `${v}%`} />,
  },
  { label: 'Recruiters', cell: (c) => c.college.recruitersNote ?? '–' },
  {
    group: 'Air',
    label: 'Annual AQI',
    cell: (c) =>
      c.city ? (
        <SourcedValue
          sourced={c.city.annualAQI}
          format={(v) => `${Math.round(v)} · ${naqiBand(Math.round(v))}`}
        />
      ) : (
        '–'
      ),
  },
  { label: '"Poor+" days / year', cell: (c) => <SourcedValue sourced={c.city?.poorDaysPerYear} /> },
  { label: 'Worst month', cell: (c) => c.city?.worstMonth ?? '–' },
  {
    group: 'Cost (₹/month, all-in)',
    label: 'PG double',
    cell: (c) => (
      <span className="inline-flex items-center gap-1">
        {formatInrRange(c.city?.costs?.pgDoubleAllIn)}
        {costNote(c.city)}
      </span>
    ),
  },
  {
    label: 'PG single',
    cell: (c) => (
      <span className="inline-flex items-center gap-1">
        {formatInrRange(c.city?.costs?.pgSingleAllIn)}
        {costNote(c.city)}
      </span>
    ),
  },
  {
    label: '1BHK flat',
    cell: (c) => (
      <span className="inline-flex items-center gap-1">
        {formatInrRange(c.city?.costs?.flat1bhkAllIn)}
        {costNote(c.city)}
      </span>
    ),
  },
  {
    label: 'Bungalow',
    cell: (c) => (
      <span className="inline-flex items-center gap-1">
        {formatInrRange(c.city?.costs?.bungalowAllIn)}
        {costNote(c.city)}
      </span>
    ),
  },
  {
    label: 'Deposit · brokerage',
    cell: (c) =>
      c.city?.costs ? `${c.city.costs.depositMonths} · ${c.city.costs.brokerage}` : '–',
  },
  {
    group: 'Living',
    label: 'Living score',
    cell: (c) => (c.city?.livingScore == null ? '–' : `${c.city.livingScore}/10`),
  },
  {
    label: 'From Surat',
    cell: (c) =>
      c.city?.distanceFromHomeKm === undefined ? '–' : `${c.city.distanceFromHomeKm} km (straight)`,
  },
  { label: 'Pros', cell: (c) => c.city?.pros ?? '–' },
  { label: 'Watch-outs', cell: (c) => c.city?.watchOuts ?? c.college.notes ?? '–' },
]

/** Compare tab (SPEC §6.4): up to 3 colleges side by side, every field. */
export function ComparePanel({ results }: { results: Results }) {
  const data = useAppStore((s) => s.data)
  const ids = useAppStore((s) => s.compareIds)
  const toggle = useAppStore((s) => s.toggleCompare)
  const uid = useId()
  if (!data) return null

  const cityById = new Map(data.cities.data.map((c) => [c.id, c]))
  const cols: Col[] = ids
    .map((id) => data.colleges.data.find((c) => c.id === id))
    .filter((c) => c !== undefined)
    .map((college) => {
      const r = results.rows.find((x) => x.college.id === college.id)
      return {
        college,
        city: cityById.get(college.cityId),
        final: r?.final ?? null,
        rank: r?.rank ?? null,
        scores: r?.scores ?? null,
        visible: !!r,
      }
    })

  const pickable = results.rows.filter((r) => !r.excluded)

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-xs">
      <details open={ids.length === 0} className="rounded-md border px-2 py-1">
        <summary className="cursor-pointer font-medium">
          Choose colleges ({ids.length}/{MAX_COMPARE})
        </summary>
        <ul className="mt-1 grid grid-cols-2 gap-1">
          {pickable.map((r) => {
            const checked = ids.includes(r.college.id)
            return (
              <li key={r.college.id} className="flex items-center gap-1.5">
                <Checkbox
                  id={`${uid}-${r.college.id}`}
                  checked={checked}
                  disabled={!checked && ids.length >= MAX_COMPARE}
                  onCheckedChange={() => toggle(r.college.id)}
                />
                <Label htmlFor={`${uid}-${r.college.id}`} className="text-[11px] font-normal">
                  {r.college.name.replace(' (backup)', '')}
                </Label>
              </li>
            )
          })}
        </ul>
      </details>

      {cols.length === 0 ? (
        <p className="p-2 text-muted-foreground">
          Pick 2 or 3 colleges above (or use “Compare” on a college card).
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse" aria-label="College comparison">
            <thead className="sticky top-0 z-10 bg-background">
              <tr>
                <th scope="col" className="w-28 border-b p-1 text-left text-muted-foreground">
                  Field
                </th>
                {cols.map((c) => (
                  <th key={c.college.id} scope="col" className="border-b p-1 text-left align-top">
                    <div className="flex items-start gap-1">
                      <span className="font-semibold">
                        {c.college.name.replace(' (backup)', '')}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${c.college.name} from compare`}
                        className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted"
                        onClick={() => toggle(c.college.id)}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <FragmentRow key={row.label} row={row} cols={cols} />
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Hover a letter badge for the source and date. The Charts tab shows these colleges on one
            radar.
          </p>
        </div>
      )}
    </div>
  )
}

function FragmentRow({ row, cols }: { row: Row; cols: Col[] }) {
  return (
    <>
      {row.group && (
        <tr>
          <th
            colSpan={cols.length + 1}
            scope="colgroup"
            className="bg-muted/60 px-1 py-0.5 text-left text-[11px] font-semibold"
          >
            {row.group}
          </th>
        </tr>
      )}
      <tr className="border-b align-top">
        <th scope="row" className="p-1 text-left font-normal text-muted-foreground">
          {row.label}
        </th>
        {cols.map((c) => (
          <td key={c.college.id} className="p-1">
            {row.cell(c)}
          </td>
        ))}
      </tr>
    </>
  )
}
