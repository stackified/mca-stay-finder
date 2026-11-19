import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/** Results tabs from SPEC §6.4. */
const TABS = [
  { id: 'ranked', label: 'Ranked', phase: 3 },
  { id: 'stays', label: 'Stays', phase: 4 },
  { id: 'charts', label: 'Charts', phase: 7 },
  { id: 'compare', label: 'Compare', phase: 7 },
] as const

export function ResultsPanel() {
  return (
    <Tabs defaultValue="ranked" className="flex h-full flex-col p-3">
      <TabsList className="w-full">
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.id} value={t.id} className="text-sm text-muted-foreground">
          {t.label} comes in Phase {t.phase}.
        </TabsContent>
      ))}
    </Tabs>
  )
}
