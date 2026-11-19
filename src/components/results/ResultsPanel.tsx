import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useResults } from '@/store/useAppStore'
import { EmptyState } from './EmptyState'
import { RankedTable } from './RankedTable'

/** Results tabs from SPEC §6.4. */
const LATER = [
  { id: 'stays', label: 'Stays', phase: 4 },
  { id: 'charts', label: 'Charts', phase: 7 },
  { id: 'compare', label: 'Compare', phase: 7 },
] as const

export function ResultsPanel() {
  const results = useResults()
  return (
    <Tabs defaultValue="ranked" className="flex h-full min-h-0 flex-col p-2">
      <TabsList className="w-full">
        <TabsTrigger value="ranked">Ranked</TabsTrigger>
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
      {LATER.map((t) => (
        <TabsContent key={t.id} value={t.id} className="p-2 text-sm text-muted-foreground">
          {t.label} comes in Phase {t.phase}.
        </TabsContent>
      ))}
    </Tabs>
  )
}
