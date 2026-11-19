import { Suspense, lazy, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { useSeedData } from '@/lib/data'
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
 * App shell (SPEC §6.1): top bar, 3 columns (filters | map | results), status bar.
 * Desktop = 3 columns. Below `lg` the panels stack under the map.
 * Mobile bottom sheets come in Phase 7.
 */
export default function App() {
  const seed = useSeedData()
  // Phase 3 moves this into the Zustand store.
  const [selectedCollegeId, setSelectedCollegeId] = useState<string | null>(null)

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <TopBar />
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)_380px]">
          <aside
            aria-label="Filters"
            className="order-2 min-h-0 border-t lg:order-1 lg:border-t-0 lg:border-r"
          >
            <FilterPanel />
          </aside>
          <main aria-label="Map" className="order-1 h-[55dvh] min-h-0 lg:order-2 lg:h-auto">
            {seed.status === 'loading' && <MapMessage>Loading data…</MapMessage>}
            {seed.status === 'error' && (
              <MapMessage>
                <span role="alert">Could not load data: {seed.error}</span>
              </MapMessage>
            )}
            {seed.status === 'ready' && (
              <Suspense fallback={<MapMessage>Loading map…</MapMessage>}>
                <MapView
                  data={seed.data}
                  selectedCollegeId={selectedCollegeId}
                  onSelectCollege={setSelectedCollegeId}
                />
              </Suspense>
            )}
          </main>
          <aside
            aria-label="Results"
            className="order-3 min-h-0 border-t lg:border-t-0 lg:border-l"
          >
            <ResultsPanel />
          </aside>
        </div>
        <StatusBar data={seed.status === 'ready' ? seed.data : null} />
      </div>
    </TooltipProvider>
  )
}
