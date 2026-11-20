import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

/**
 * SPEC §12/§13: offline, the app runs from the service-worker cache; say so, with the data date.
 */
export function OfflineBanner() {
  const online = useOnline()
  const generatedAt = useAppStore((s) => s.data?.colleges.meta.generatedAt)
  // Also show when the network is up but the app server was not reachable (cached files used).
  const fromCache = useAppStore((s) => s.data?.fromCache ?? false)
  if (online && !fromCache) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-sky-300 bg-sky-50 px-4 py-1 text-xs text-sky-950 dark:bg-sky-950 dark:text-sky-100"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      <span>
        {online ? 'The app server is unreachable' : 'You are offline'} — using cached data
        {generatedAt ? ` from ${generatedAt}` : ''}. Map areas you have not opened before stay
        blank; your saved notes and listings still work.
      </span>
    </div>
  )
}
