import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Confidence, Sourced } from '@/types/domain'

const CONFIDENCE: Record<Confidence, { short: string; label: string; className: string }> = {
  official: {
    short: 'O',
    label: 'Official',
    className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  },
  aggregator: {
    short: 'A',
    label: 'Aggregator',
    className: 'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100',
  },
  estimate: {
    short: 'E',
    label: 'Estimate',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  },
  none: { short: '–', label: 'No data', className: 'bg-muted text-muted-foreground' },
}

/**
 * Confidence badge. Hover or focus shows source, date, confidence and note (SPEC §13).
 */
export function ConfidenceBadge({ sourced }: { sourced: Omit<Sourced<unknown>, 'value'> }) {
  const c = CONFIDENCE[sourced.confidence]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${c.label}. Show source`}
          className={cn(
            'inline-flex size-4 shrink-0 items-center justify-center rounded text-[10px] leading-none font-semibold',
            c.className,
          )}
        >
          {c.short}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-xs">
        <p className="font-semibold">{c.label}</p>
        {sourced.source && <p>Source: {sourced.source}</p>}
        {sourced.asOf && <p>As of: {sourced.asOf}</p>}
        {sourced.note && <p>Note: {sourced.note}</p>}
      </TooltipContent>
    </Tooltip>
  )
}

/** A value with its confidence badge. `format` turns the raw value into text. */
export function SourcedValue<T>({
  sourced,
  format = (v) => String(v),
}: {
  sourced: Sourced<T> | undefined
  format?: (v: T) => string
}) {
  if (!sourced) return <span className="text-muted-foreground">–</span>
  return (
    <span className="inline-flex items-center gap-1">
      <span className={sourced.value === null ? 'text-muted-foreground' : undefined}>
        {sourced.value === null ? 'No data' : format(sourced.value)}
      </span>
      <ConfidenceBadge sourced={sourced} />
    </span>
  )
}
