import { Plus } from 'lucide-react'
import { PresetsMenu } from '@/components/filters/PresetsMenu'
import { WeightsPopover } from '@/components/filters/WeightsPopover'
import { BudgetDialog } from '@/components/tools/BudgetDialog'
import { ExportImportDialog } from '@/components/tools/ExportImportDialog'
import { ShortlistPopover } from '@/components/tools/ShortlistPopover'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'

/** Top bar (SPEC §6.1). Compare and Help arrive in Phase 7. */
export function TopBar() {
  const openListingForm = useAppStore((s) => s.openListingForm)
  return (
    <header className="flex flex-wrap items-center gap-1 border-b px-4 py-1.5">
      <h1 className="mr-auto text-base font-semibold">MCA Campus &amp; Stay Finder</h1>
      <nav aria-label="Main actions" className="flex flex-wrap items-center gap-1">
        <PresetsMenu />
        <WeightsPopover />
        <ShortlistPopover />
        <Button variant="ghost" size="sm" onClick={() => openListingForm()}>
          <Plus />
          Add listing
        </Button>
        <BudgetDialog />
        <ExportImportDialog />
        <Button variant="ghost" size="sm" disabled title="Comes in Phase 7">
          Compare
        </Button>
        <Button variant="ghost" size="sm" aria-label="Help" disabled title="Comes in Phase 7">
          ?
        </Button>
      </nav>
    </header>
  )
}
