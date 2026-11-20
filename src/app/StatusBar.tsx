import { useAppStore, useResults } from '@/store/useAppStore'

/** Status bar (SPEC §6.1): live match counts + data date. Stays are added in Phase 4. */
export function StatusBar() {
  const results = useResults()
  const generatedAt = useAppStore((s) => s.data?.colleges.meta.generatedAt)
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-1.5 text-xs text-muted-foreground">
      <span aria-live="polite">
        {results
          ? `${results.matchCount} colleges · ${new Set(results.rows.filter((r) => !r.excluded).map((r) => r.college.cityId)).size} cities · ${results.stays.length} stays match`
          : 'Loading…'}
      </span>
      <span>
        {generatedAt ? `Seed data: ${generatedAt} · costs are estimates` : 'No data loaded yet'}
      </span>
    </footer>
  )
}
