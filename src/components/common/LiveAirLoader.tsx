import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Banner when live AQI is not fresh (SPEC §12 "using cached data from {date}", §7 "API is down").
 * Hidden when the data is live or from the < 1 h cache.
 */
export function LiveAirBanner({ onRetry }: { onRetry: () => void }) {
  const live = useAppStore((s) => s.live)
  const r = live.result
  if (!r || r.source === 'live' || r.source === 'cache') return null
  const text =
    r.source === 'none'
      ? 'Live air quality is unavailable (offline or Open-Meteo down). Annual AQI still works; the live filter is off.'
      : r.source === 'stale-cache'
        ? `Live air quality: Open-Meteo unreachable — using cached data from ${fmtTime(r.data!.fetchedAt)}.`
        : `Live air quality: Open-Meteo unreachable — using the bundled snapshot from ${fmtTime(r.data!.fetchedAt)}.`
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-1 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <span className="flex-1">{text}</span>
      <Button size="xs" variant="outline" disabled={live.loading} onClick={onRetry}>
        <RefreshCw className={live.loading ? 'animate-spin' : ''} />
        Retry
      </Button>
    </div>
  )
}
