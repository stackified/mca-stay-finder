import { ChevronDown } from 'lucide-react'
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
import { useAppStore } from '@/store/useAppStore'

/** One-click presets (SPEC §6.2 E). */
export function PresetsMenu() {
  const applyPreset = useAppStore((s) => s.applyPreset)
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
        <DropdownMenuItem disabled className="text-xs">
          Save current as preset (Phase 5)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
