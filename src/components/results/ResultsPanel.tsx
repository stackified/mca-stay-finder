import { lazy, Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore, useResults, type ResultsTab } from '@/store/useAppStore'
import { ComparePanel } from './ComparePanel'
import { EmptyState } from './EmptyState'
import { RankedTable } from './RankedTable'
import { StayList } from './StayList'

// Recharts is only needed on the Charts tab: load it in its own chunk.
const ChartsPanel = lazy(() => import('./ChartsPanel').then((m) => ({ default: m.ChartsPanel })))

/** Results tabs (SPEC §6.4): Ranked, Stays, Charts, Compare. */
export function ResultsPanel() {
  const results = useResults()
  const tab = useAppStore((s) => s.resultsTab)
  const setTab = useAppStore((s) => s.setResultsTab)
  const compareCount = useAppStore((s) => s.compareIds.length)
  const loading = <p className="p-2 text-xs text-muted-foreground">Loading…</p>
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as ResultsTab)}
      className="flex h-full min-h-0 flex-col p-2"
    >
      <TabsList className="w-full">
        <TabsTrigger value="ranked">Ranked</TabsTrigger>
        <TabsTrigger value="stays">Stays{results ? ` (${results.stays.length})` : ''}</TabsTrigger>
        <TabsTrigger value="charts">Charts</TabsTrigger>
        <TabsTrigger value="compare">Compare{compareCount ? ` (${compareCount})` : ''}</TabsTrigger>
      </TabsList>
      <TabsContent value="ranked" className="min-h-0 flex-1">
        {!results ? (
          loading
        ) : results.matchCount === 0 ? (
          <EmptyState impact={results.impact} />
        ) : (
          <RankedTable rows={results.rows} />
        )}
      </TabsContent>
      <TabsContent value="stays" className="min-h-0 flex-1">
        {results ? <StayList results={results} /> : loading}
      </TabsContent>
      <TabsContent value="charts" className="min-h-0 flex-1">
        {results ? (
          <Suspense fallback={loading}>
            <ChartsPanel results={results} />
          </Suspense>
        ) : (
          loading
        )}
      </TabsContent>
      <TabsContent value="compare" className="min-h-0 flex-1">
        {results ? <ComparePanel results={results} /> : loading}
      </TabsContent>
    </Tabs>
  )
}
