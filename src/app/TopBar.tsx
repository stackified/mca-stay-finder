import { PresetsMenu } from '@/components/filters/PresetsMenu'
import { WeightsPopover } from '@/components/filters/WeightsPopover'
import { Button } from '@/components/ui/button'

/** Top bar (SPEC §6.1). Shortlist, Compare and Export arrive in Phases 5 and 7. */
const LATER = [
  { label: 'Shortlist (0)', phase: 5 },
  { label: 'Compare', phase: 7 },
  { label: 'Export', phase: 5 },
] as const

export function TopBar() {
  return (
    <header className="flex flex-wrap items-center gap-1 border-b px-4 py-1.5">
      <h1 className="mr-auto text-base font-semibold">MCA Campus &amp; Stay Finder</h1>
      <nav aria-label="Main actions" className="flex flex-wrap items-center gap-1">
        <PresetsMenu />
        <WeightsPopover />
        {LATER.map((a) => (
          <Button
            key={a.label}
            variant="ghost"
            size="sm"
            disabled
            title={`Comes in Phase ${a.phase}`}
          >
            {a.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" aria-label="Help" disabled title="Comes in Phase 7">
          ?
        </Button>
      </nav>
    </header>
  )
}
