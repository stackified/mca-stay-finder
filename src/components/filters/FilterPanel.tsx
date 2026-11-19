import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'

/** Filter groups from SPEC §6.2. Controls arrive in Phase 3 (A, B, D) and Phase 4 (C). */
const GROUPS = [
  { id: 'college', title: 'A. College', phase: 3 },
  { id: 'city', title: 'B. City', phase: 3 },
  { id: 'stay', title: 'C. Stay', phase: 4 },
] as const

export function FilterPanel() {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <h2 className="mb-2 text-sm font-semibold">Filters</h2>
        <Accordion type="multiple" defaultValue={['college']}>
          {GROUPS.map((g) => (
            <AccordionItem key={g.id} value={g.id}>
              <AccordionTrigger>{g.title}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Filters come in Phase {g.phase}.
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </ScrollArea>
  )
}
