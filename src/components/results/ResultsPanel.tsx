import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore, useResults, type ResultsTab } from '@/store/useAppStore'
import { EmptyState } from './EmptyState'
import { RankedTable } from './RankedTable'
import { StayList } from './StayList'

/** Results tabs from SPEC §6.4. Charts and Compare arrive in Phase 7. */
const LATER = [
  { id: 'charts', label: 'Charts', phase: 7 },
  { id: 'compare', label: 'Compare', phase: 7 },
] as const

export function ResultsPanel() {
  const results = useResults()
  const tab = useAppStore((s) => s.resultsTab)
  const setTab = useAppStore((s) => s.setResultsTab)
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as ResultsTab)}
      className="flex h-full min-h-0 flex-col p-2"
    >
      <TabsList className="w-full">
        <TabsTrigger value="ranked">Ranked</TabsTrigger>
        <TabsTrigger value="stays">Stays{results ? ` (${results.stays.length})` : ''}</TabsTrigger>
        {LATER.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="ranked" className="min-h-0 flex-1">
        {!results ? (
          <p className="p-2 text-xs text-muted-foreground">Loading…</p>
        ) : results.matchCount === 0 ? (
          <EmptyState impact={results.impact} />
        ) : (
          <RankedTable rows={results.rows} />
        )}
      </TabsContent>
      <TabsContent value="stays" className="min-h-0 flex-1">
        {results ? <StayList results={results} /> : null}
      </TabsContent>
      {LATER.map((t) => (
        <TabsContent key={t.id} value={t.id} className="p-2 text-sm text-muted-foreground">
          {t.label} comes in Phase {t.phase}.
        </TabsContent>
      ))}
    </Tabs>
  )
}
