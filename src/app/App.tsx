import { Suspense, lazy, useEffect, useState } from 'react'
import { ListFilter, Rows3 } from 'lucide-react'
import { LiveAirBanner } from '@/components/common/LiveAirLoader'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { AddListingDialog } from '@/components/tools/AddListingDialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSeedData } from '@/lib/data'
import { changedFilterIds } from '@/lib/filters'
import { changedStayFilters } from '@/lib/stays'
import { useMediaQuery, useTheme } from '@/lib/theme'
import { useAppStore, useResults } from '@/store/useAppStore'
import { useLiveAirLoader } from '@/store/useLiveAirLoader'
import { StatusBar } from './StatusBar'
import { TopBar } from './TopBar'

// MapLibre is large; load it in its own chunk so the shell paints first.
const MapView = lazy(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })))

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-muted/40 p-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/**
 * App shell (SPEC §6.1, §12):
 *   desktop (≥ 1024 px): top bar, 3 columns (filters | map | results), status bar;
 *   mobile / tablet:     full-screen map, filters and results in bottom sheets.
 */
export default function App() {
  const seed = useSeedData()
  const setData = useAppStore((s) => s.setData)
  const results = useResults()
  const theme = useTheme()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [sheet, setSheet] = useState<'filters' | 'results' | null>(null)
  const filters = useAppStore((s) => s.filters)
  const activeCount = changedFilterIds(filters).length + changedStayFilters(filters).length

  useEffect(() => {
    if (seed.status === 'ready') setData(seed.data)
  }, [seed, setData])
  const reloadLive = useLiveAirLoader()

  const map = (
    <>
      {seed.status === 'loading' && <MapMessage>Loading data…</MapMessage>}
      {seed.status === 'error' && (
        <MapMessage>
          <span role="alert">Could not load data: {seed.error}</span>
        </MapMessage>
      )}
      {seed.status === 'ready' && results && (
        <Suspense fallback={<MapMessage>Loading map…</MapMessage>}>
          <MapView results={results} theme={theme.resolved} />
        </Suspense>
      )}
    </>
  )

  return (
    <TooltipProvider>
      <a
        href="#results"
        className="sr-only z-50 rounded bg-background px-3 py-2 text-sm shadow focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
        onClick={() => !desktop && setSheet('results')}
      >
        Skip to results
      </a>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <TopBar theme={theme.choice} onThemeChange={theme.setChoice} />
        <OfflineBanner />
        <LiveAirBanner onRetry={() => void reloadLive(true)} />
        {desktop ? (
          <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_340px] overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)_420px]">
            <aside aria-label="Filters" className="min-h-0 border-r">
              <FilterPanel />
            </aside>
            <main aria-label="Map" className="min-h-0">
              {map}
            </main>
            <aside id="results" tabIndex={-1} aria-label="Results" className="min-h-0 border-l">
              <ResultsPanel />
            </aside>
          </div>
        ) : (
          <>
            <main aria-label="Map" className="relative min-h-0 flex-1">
              {map}
            </main>
            {/* A bar below the map, so the buttons never cover the map attribution. */}
            <div className="flex justify-center gap-2 border-t px-3 py-2">
              <Button className="flex-1" onClick={() => setSheet('filters')}>
                <ListFilter />
                Filters{activeCount ? ` (${activeCount})` : ''}
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => setSheet('results')}>
                <Rows3 />
                Results{results ? ` (${results.matchCount})` : ''}
              </Button>
            </div>
            <Sheet open={sheet === 'filters'} onOpenChange={(o) => setSheet(o ? 'filters' : null)}>
              <SheetContent side="bottom" className="gap-0 p-0 data-[side=bottom]:h-[80dvh]">
                <SheetHeader className="border-b px-3 py-2">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription className="sr-only">
                    College, city and stay filters
                  </SheetDescription>
                </SheetHeader>
                <aside aria-label="Filters" className="min-h-0 flex-1">
                  <FilterPanel />
                </aside>
              </SheetContent>
            </Sheet>
            <Sheet open={sheet === 'results'} onOpenChange={(o) => setSheet(o ? 'results' : null)}>
              <SheetContent side="bottom" className="gap-0 p-0 data-[side=bottom]:h-[80dvh]">
                <SheetHeader className="border-b px-3 py-2">
                  <SheetTitle>Results</SheetTitle>
                  <SheetDescription className="sr-only">
                    Ranked colleges, stays, charts and compare
                  </SheetDescription>
                </SheetHeader>
                <aside id="results" aria-label="Results" className="min-h-0 flex-1">
                  <ResultsPanel />
                </aside>
              </SheetContent>
            </Sheet>
          </>
        )}
        <StatusBar onRefreshLive={() => void reloadLive(true)} />
        <AddListingDialog />
      </div>
    </TooltipProvider>
  )
}
