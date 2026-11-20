/**
 * Light / dark mode (SPEC §12). Choice: system | light | dark, kept in localStorage
 * (a per-device convenience). index.html applies it before first paint (no flash).
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
export const THEME_KEY = 'mca-theme'

const media = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): 'light' | 'dark' =>
  choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

export function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

/** Current system preference, updating live. */
function useSystemDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = media()
      m?.addEventListener('change', cb)
      return () => m?.removeEventListener('change', cb)
    },
    () => media()?.matches ?? false,
    () => false,
  )
}

/** Theme choice + resolved theme; applies the class on <html>. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice)
  const systemDark = useSystemDark()
  const resolved = resolveTheme(choice, systemDark)
  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])
  const set = (c: ThemeChoice) => {
    setChoice(c)
    try {
      if (c === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, c)
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
  }
  return { choice, resolved, setChoice: set }
}

/** Matches a CSS media query, updating live (used for the mobile layout). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia?.(query)
      m?.addEventListener('change', cb)
      return () => m?.removeEventListener('change', cb)
    },
    () => window.matchMedia?.(query).matches ?? true,
    () => true,
  )
}
