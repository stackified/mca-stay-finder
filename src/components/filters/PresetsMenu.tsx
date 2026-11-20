import { ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PRESETS } from '@/lib/presets'
import { encodeUrlState } from '@/lib/urlState'
import { getDb, savePreset } from '@/store/db'
import { useAppStore } from '@/store/useAppStore'
import { useSavedPresets } from '@/store/useOwnerData'

/** One-click presets (SPEC §6.2 E), plus the owner's own saved presets (IndexedDB). */
export function PresetsMenu() {
  const applyPreset = useAppStore((s) => s.applyPreset)
  const applyQuery = useAppStore((s) => s.applyQuery)
  const saved = useSavedPresets()

  const saveCurrent = () => {
    const name = window
      .prompt('Name for this preset (filters, weights, sort and selection):')
      ?.trim()
    if (!name) return
    const exists = saved.some((p) => p.name === name)
    if (exists && !window.confirm(`Replace the preset "${name}"?`)) return
    // A saved preset is the current URL state: compact and already validated when read back.
    void savePreset(getDb(), name.slice(0, 60), encodeUrlState(useAppStore.getState()))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Presets
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Presets</DropdownMenuLabel>
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => applyPreset(p.id)}
            className="flex-col items-start gap-0"
          >
            <span className="text-sm">{p.label}</span>
            <span className="text-xs text-muted-foreground">{p.description}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>My presets</DropdownMenuLabel>
        {saved.length === 0 && (
          <p className="px-2 pb-1 text-xs text-muted-foreground">None saved yet.</p>
        )}
        {saved.map((p) => (
          <DropdownMenuItem
            key={p.name}
            onSelect={() => applyQuery(p.query)}
            className="justify-between"
          >
            <span className="truncate text-sm">{p.name}</span>
            <button
              type="button"
              aria-label={`Delete preset ${p.name}`}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (window.confirm(`Delete the preset "${p.name}"?`))
                  void getDb().presets.delete(p.name)
              }}
            >
              <X className="size-3" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={saveCurrent} className="text-xs">
          + Save current view as preset…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
