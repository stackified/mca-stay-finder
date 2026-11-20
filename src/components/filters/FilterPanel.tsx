import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { changedFilterIds, type FilterId } from '@/lib/filters'
import { changedStayFilters, DEFAULT_STAY_FILTERS } from '@/lib/stays'
import { useAppStore } from '@/store/useAppStore'
import { CityFilters } from './CityFilters'
import { CollegeFilters } from './CollegeFilters'
import { StayFilters } from './StayFilters'

const CITY_IDS: FilterId[] = [
  'annualAqiMax',
  'poorDaysMax',
  'costMax',
  'livingMin',
  'regions',
  'homeDistanceMaxKm',
]

/** Filter groups from SPEC §6.2 (A college, B city, C stay). */
export function FilterPanel() {
  const filters = useAppStore((s) => s.filters)
  const resetFilters = useAppStore((s) => s.resetFilters)
  const ready = useAppStore((s) => s.data !== null)

  const active = changedFilterIds(filters)
  const cityCount =
    active.filter((id) => CITY_IDS.includes(id)).length + (filters.showExcluded ? 1 : 0)
  const collegeCount = active.length - active.filter((id) => CITY_IDS.includes(id)).length
  const stayCount =
    changedStayFilters(filters).length +
    (filters.stayMaxDistanceKm !== DEFAULT_STAY_FILTERS.stayMaxDistanceKm ? 1 : 0)
  const total = cityCount + collegeCount + stayCount

  const count = (n: number) =>
    n > 0 && (
      <Badge variant="secondary" className="mr-1 ml-auto h-4 px-1.5 text-[10px]">
        {n}
      </Badge>
    )

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filters</h2>
          {total > 0 && (
            <Button variant="ghost" size="xs" onClick={() => resetFilters()}>
              Reset all ({total})
            </Button>
          )}
        </div>
        {!ready ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <Accordion type="multiple" defaultValue={['college', 'city']}>
            <AccordionItem value="college">
              <AccordionTrigger className="text-sm">
                <span>A. College</span>
                {count(collegeCount)}
              </AccordionTrigger>
              <AccordionContent>
                <CollegeFilters />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="city">
              <AccordionTrigger className="text-sm">
                <span>B. City</span>
                {count(cityCount)}
              </AccordionTrigger>
              <AccordionContent>
                <CityFilters />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="stay">
              <AccordionTrigger className="text-sm">
                <span>C. Stay</span>
                {count(stayCount)}
              </AccordionTrigger>
              <AccordionContent>
                <StayFilters />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </ScrollArea>
  )
}
