import { useMemo } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { ConfidenceBadge } from '@/components/common/SourcedValue'
import { Badge } from '@/components/ui/badge'
import { rangeMid } from '@/lib/filters'
import { formatInrRange } from '@/lib/format'
import { SCORE_BAND_STYLE, formatScore, scoreBand, type RankedCollege } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'

const col = createColumnHelper<RankedCollege>()
const num = (v: number | null | undefined) => v ?? undefined
const sub = (v: number | undefined) => (v === undefined ? '–' : v.toFixed(1))

/**
 * Ranked colleges (SPEC §6.4). Sortable; clicking a row (or Enter) selects the college on the map.
 * Default order = rank. Excluded colleges (when shown) are greyed and unranked.
 */
export function RankedTable({ rows }: { rows: RankedCollege[] }) {
  const sorting = useAppStore((s) => s.sorting)
  const setSorting = useAppStore((s) => s.setSorting)
  const selectedId = useAppStore((s) => s.selectedCollegeId)
  const select = useAppStore((s) => s.selectCollege)

  const columns = useMemo(
    () => [
      col.accessor((r) => num(r.rank), {
        id: 'rank',
        header: '#',
        sortUndefined: 'last',
        cell: (c) => c.getValue() ?? '–',
      }),
      col.accessor((r) => r.college.name, {
        id: 'institute',
        header: 'Institute',
        cell: ({ row: { original: r } }) => (
          <div className="min-w-36">
            <div className="flex items-center gap-1 font-medium">
              {r.college.name.replace(' (backup)', '')}
              {r.college.type === 'VIT' && (
                <Badge variant="outline" className="h-4 px-1 text-[9px]">
                  backup
                </Badge>
              )}
              {r.excluded && (
                <Badge variant="outline" className="h-4 px-1 text-[9px]">
                  excluded
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground">{r.city?.name ?? r.college.cityId}</div>
          </div>
        ),
      }),
      col.accessor((r) => num(r.final), {
        id: 'final',
        header: 'Final',
        sortUndefined: 'last',
        cell: (c) => {
          const v = c.getValue() ?? null
          const style = SCORE_BAND_STYLE[scoreBand(v)]
          return (
            <span
              className="inline-block min-w-9 rounded px-1 py-0.5 text-center font-semibold tabular-nums"
              style={{ backgroundColor: style.color, color: style.text }}
            >
              {formatScore(v)}
            </span>
          )
        },
      }),
      col.accessor((r) => r.college.verdict, { id: 'verdict', header: 'Verdict' }),
      col.accessor((r) => num(r.college.avgPackageLPA.value), {
        id: 'avgPackage',
        header: 'Avg pkg',
        sortUndefined: 'last',
        cell: ({ row: { original: r } }) => (
          <span className="inline-flex items-center gap-1 tabular-nums">
            {r.college.avgPackageLPA.value ?? '–'}
            <ConfidenceBadge sourced={r.college.avgPackageLPA} />
          </span>
        ),
      }),
      col.accessor((r) => r.scores?.placement, {
        id: 'placement',
        header: 'P',
        sortUndefined: 'last',
        cell: (c) => sub(c.getValue()),
      }),
      col.accessor((r) => num(r.city?.annualAQI.value), {
        id: 'aqi',
        header: 'AQI',
        sortUndefined: 'last',
        cell: ({ row: { original: r } }) =>
          r.city ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              {r.city.annualAQI.value === null ? '–' : Math.round(r.city.annualAQI.value)}
              <ConfidenceBadge sourced={r.city.annualAQI} />
            </span>
          ) : (
            '–'
          ),
      }),
      col.accessor((r) => r.scores?.air, {
        id: 'air',
        header: 'A',
        sortUndefined: 'last',
        cell: (c) => sub(c.getValue()),
      }),
      col.accessor((r) => (r.city?.costs ? rangeMid(r.city.costs.pgDoubleAllIn) : undefined), {
        id: 'pgDouble',
        header: 'PG double',
        sortUndefined: 'last',
        cell: ({ row: { original: r } }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatInrRange(r.city?.costs?.pgDoubleAllIn)}
          </span>
        ),
      }),
      col.accessor((r) => (r.city?.costs ? rangeMid(r.city.costs.flat1bhkAllIn) : undefined), {
        id: 'flat1bhk',
        header: '1BHK',
        sortUndefined: 'last',
        cell: ({ row: { original: r } }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatInrRange(r.city?.costs?.flat1bhkAllIn)}
          </span>
        ),
      }),
      col.accessor((r) => r.scores?.cost, {
        id: 'cost',
        header: 'C',
        sortUndefined: 'last',
        cell: (c) => sub(c.getValue()),
      }),
      col.accessor((r) => r.scores?.living, {
        id: 'living',
        header: 'L',
        sortUndefined: 'last',
        cell: (c) => sub(c.getValue()),
      }),
    ],
    [],
  )

  // The app does not use the React Compiler, so this TanStack warning does not apply.
  // oxlint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (u: Updater<SortingState>) =>
      setSorting(typeof u === 'function' ? u(sorting) : u),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (r) => r.college.id,
  })

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-xs" aria-label="Ranked colleges">
        <thead className="sticky top-0 z-10 bg-background">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b">
              {hg.headers.map((h) => {
                const dir = h.column.getIsSorted()
                return (
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
                    className="px-1.5 py-1.5 text-left font-medium whitespace-nowrap text-muted-foreground"
                  >
                    <button
                      type="button"
                      onClick={h.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                      title={COLUMN_TITLES[h.id]}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {dir === 'asc' ? (
                        <ArrowUp className="size-3" />
                      ) : dir === 'desc' ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30" />
                      )}
                    </button>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const r = row.original
            const selected = r.college.id === selectedId
            return (
              <tr
                key={row.id}
                tabIndex={0}
                aria-selected={selected}
                onClick={() => select(r.college.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    select(r.college.id)
                  }
                }}
                className={cn(
                  'cursor-pointer border-b align-top hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600',
                  selected && 'bg-blue-50 dark:bg-blue-950',
                  r.excluded && 'opacity-50',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-1.5 py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const COLUMN_TITLES: Record<string, string> = {
  rank: 'Rank by final score',
  final: 'Final score 0–10 (weighted)',
  avgPackage: 'MCA average package, LPA',
  placement: 'Placement sub-score 0–10',
  aqi: 'City annual AQI (Indian NAQI)',
  air: 'Air sub-score 0–10',
  pgDouble: 'PG double sharing, all-in ₹/month (estimate)',
  flat1bhk: '1BHK flat, all-in ₹/month (estimate)',
  cost: 'Cost sub-score 0–10',
  living: 'Living-standard sub-score 0–10',
}
