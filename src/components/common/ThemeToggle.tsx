import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ThemeChoice } from '@/lib/theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemeChoice, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
}

/** Cycles system → light → dark. */
export function ThemeToggle({
  choice,
  onChange,
}: {
  choice: ThemeChoice
  onChange: (c: ThemeChoice) => void
}) {
  const Icon = choice === 'dark' ? Moon : choice === 'light' ? Sun : Monitor
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(NEXT[choice])}
      aria-label={`${LABEL[choice]} (click for ${LABEL[NEXT[choice]].toLowerCase()})`}
      title={`${LABEL[choice]} — click to change`}
    >
      <Icon />
    </Button>
  )
}
