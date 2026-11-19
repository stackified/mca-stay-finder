import type { SeedData } from '@/lib/data'
import { collegeMarkers } from '@/lib/mapData'

/**
 * Status bar (SPEC §6.1). Phase 2 counts the default-visible colleges and their cities.
 * Phase 3 replaces this with live filter counts; Phase 4 adds stays.
 */
export function StatusBar({ data }: { data: SeedData | null }) {
  const visible = data ? collegeMarkers(data.colleges.data, data.cities.data) : []
  const cityCount = new Set(visible.map((m) => m.college.cityId)).size
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-1.5 text-xs text-muted-foreground">
      <span>
        {visible.length} colleges · {cityCount} cities · 0 stays match
      </span>
      <span>
        {data
          ? `Seed data: ${data.colleges.meta.generatedAt} · costs are estimates`
          : 'No data loaded yet'}
      </span>
    </footer>
  )
}
