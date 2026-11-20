import { Columns3, Plus } from 'lucide-react'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { PresetsMenu } from '@/components/filters/PresetsMenu'
import { WeightsPopover } from '@/components/filters/WeightsPopover'
import { BudgetDialog } from '@/components/tools/BudgetDialog'
import { DataInfoDialog } from '@/components/tools/DataInfoDialog'
import { ExportImportDialog } from '@/components/tools/ExportImportDialog'
import { ShortlistPopover } from '@/components/tools/ShortlistPopover'
import { Button } from '@/components/ui/button'
import type { ThemeChoice } from '@/lib/theme'
import { useAppStore } from '@/store/useAppStore'

/** Top bar (SPEC §6.1). On narrow screens the actions scroll sideways. */
export function TopBar({
  theme,
  onThemeChange,
}: {
  theme: ThemeChoice
  onThemeChange: (t: ThemeChoice) => void
}) {
  const openListingForm = useAppStore((s) => s.openListingForm)
  const setTab = useAppStore((s) => s.setResultsTab)
  const compareCount = useAppStore((s) => s.compareIds.length)
  return (
    <header className="flex items-center gap-1 border-b px-2 py-1.5 sm:px-4">
      <h1 className="mr-auto shrink-0 text-sm font-semibold sm:text-base">
        MCA Campus &amp; Stay Finder
      </h1>
      <nav aria-label="Main actions" className="flex min-w-0 items-center gap-1 overflow-x-auto">
        <PresetsMenu />
        <WeightsPopover />
        <ShortlistPopover />
        <Button variant="ghost" size="sm" onClick={() => setTab('compare')}>
          <Columns3 />
          Compare{compareCount ? ` (${compareCount})` : ''}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openListingForm()}>
          <Plus />
          Add listing
        </Button>
        <BudgetDialog />
        <ExportImportDialog />
        <ThemeToggle choice={theme} onChange={onThemeChange} />
        <DataInfoDialog />
      </nav>
    </header>
  )
}
