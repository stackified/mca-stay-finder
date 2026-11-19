import { TooltipProvider } from '@/components/ui/tooltip'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { MapView } from '@/components/map/MapView'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { StatusBar } from './StatusBar'
import { TopBar } from './TopBar'

/**
 * App shell (SPEC §6.1): top bar, 3 columns (filters | map | results), status bar.
 * Desktop = 3 columns. Below `lg` the panels stack under the map.
 * Mobile bottom sheets come in Phase 7.
 */
export default function App() {
  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <TopBar />
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[300px_minmax(0,1fr)_380px] lg:overflow-hidden">
          <aside
            aria-label="Filters"
            className="order-2 min-h-0 border-t lg:order-1 lg:border-t-0 lg:border-r"
          >
            <FilterPanel />
          </aside>
          <main aria-label="Map" className="order-1 h-[55dvh] min-h-0 lg:order-2 lg:h-auto">
            <MapView />
          </main>
          <aside
            aria-label="Results"
            className="order-3 min-h-0 border-t lg:border-t-0 lg:border-l"
          >
            <ResultsPanel />
          </aside>
        </div>
        <StatusBar />
      </div>
    </TooltipProvider>
  )
}
