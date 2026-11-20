import { useAppStore, useResults } from '@/store/useAppStore'

const LIVE_LABEL = {
  live: 'live',
  cache: 'cached < 1 h',
  'stale-cache': 'old cache',
  snapshot: 'snapshot',
  none: 'unavailable',
} as const

/** Status bar (SPEC §6.1): live match counts + data dates, with a live-AQI refresh. */
export function StatusBar({ onRefreshLive }: { onRefreshLive: () => void }) {
  const results = useResults()
  const generatedAt = useAppStore((s) => s.data?.colleges.meta.generatedAt)
  const live = useAppStore((s) => s.live.result)
  const loading = useAppStore((s) => s.live.loading)
  const liveAt = live?.data
    ? new Date(live.data.fetchedAt).toLocaleString('en-IN', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-1.5 text-xs text-muted-foreground">
      <span aria-live="polite">
        {results
          ? `${results.matchCount} colleges · ${new Set(results.rows.filter((r) => !r.excluded).map((r) => r.college.cityId)).size} cities · ${results.stays.length} stays match`
          : 'Loading…'}
      </span>
      <span>
        {generatedAt ? `Seed data: ${generatedAt} · costs are estimates` : 'No data loaded yet'}
        {live && ` · Live AQI: ${LIVE_LABEL[live.source]}${liveAt ? ` (${liveAt})` : ''} `}
        {live && (
          <button
            type="button"
            onClick={onRefreshLive}
            disabled={loading}
            className="underline hover:text-foreground disabled:no-underline disabled:opacity-60"
            title="Fetch live air quality now (skips the 1-hour cache)"
          >
            {loading ? 'refreshing…' : '↻ refresh'}
          </button>
        )}
      </span>
    </footer>
  )
}
