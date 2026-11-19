import { Button } from '@/components/ui/button'

/** Top bar actions (SPEC §6.1). Buttons are placeholders until their phase. */
const ACTIONS = ['Presets', 'Weights', 'Shortlist (0)', 'Compare', 'Export'] as const

export function TopBar() {
  return (
    <header className="flex items-center gap-2 border-b px-4 py-2">
      <h1 className="mr-auto text-base font-semibold">MCA Campus &amp; Stay Finder</h1>
      <nav aria-label="Main actions" className="flex flex-wrap items-center gap-1">
        {ACTIONS.map((label) => (
          <Button key={label} variant="ghost" size="sm" disabled>
            {label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" aria-label="Help" disabled>
          ?
        </Button>
      </nav>
    </header>
  )
}
