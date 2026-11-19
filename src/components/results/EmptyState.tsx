import { Button } from '@/components/ui/button'
import type { FilterImpact } from '@/lib/filters'
import { useAppStore } from '@/store/useAppStore'

/** SPEC §6.3 empty state: name the filters that remove the most, with "Relax" buttons. */
export function EmptyState({ impact }: { impact: FilterImpact[] }) {
  const setFilters = useAppStore((s) => s.setFilters)
  const resetFilters = useAppStore((s) => s.resetFilters)
  return (
    <div role="status" className="space-y-2 p-2 text-xs">
      <p className="font-semibold">No colleges match all filters.</p>
      {impact.length > 0 ? (
        <ul className="space-y-1.5">
          {impact.slice(0, 3).map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2">
              <span>
                Relaxing <span className="font-medium">{x.label}</span> brings back {x.removed}
              </span>
              <Button size="xs" variant="outline" onClick={() => setFilters(x.relax)}>
                Relax this filter
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button size="xs" variant="ghost" onClick={() => resetFilters()}>
        Reset all filters
      </Button>
    </div>
  )
}
