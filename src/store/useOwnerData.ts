/**
 * Live views of the owner's IndexedDB data. Every write elsewhere re-renders these.
 * Derived Maps/Sets are memoised so they only change when the underlying rows change.
 */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Stay } from '@/types/domain'
import type {
  ChecklistItem,
  SavedPreset,
  ShortlistItem,
  StatusItem,
  VisitStatus,
} from '@/types/userData'
import { getDb } from './db'

// Stable "not loaded yet" values, so memo dependencies do not change on every render.
const NO_SHORTLIST: ShortlistItem[] = []
const NO_STATUS: StatusItem[] = []
const NO_LISTINGS: Stay[] = []
const NO_PRESETS: SavedPreset[] = []

export function useShortlist(): ShortlistItem[] {
  return useLiveQuery(() => getDb().shortlist.orderBy('addedAt').toArray(), [], NO_SHORTLIST)
}

export function useShortlistKeys(): Set<string> {
  const items = useShortlist()
  return useMemo(() => new Set(items.map((x) => x.key)), [items])
}

export function useStatusMap(): Map<string, VisitStatus> {
  const rows = useLiveQuery(() => getDb().status.toArray(), [], NO_STATUS)
  return useMemo(() => new Map(rows.map((r) => [r.key, r.status])), [rows])
}

export function useNote(key: string): string {
  return useLiveQuery(async () => (await getDb().notes.get(key))?.text ?? '', [key], '')
}

export function useChecklist(key: string): ChecklistItem | undefined {
  return useLiveQuery(() => getDb().checklist.get(key), [key])
}

export function useListings(): Stay[] {
  return useLiveQuery(() => getDb().listings.toArray(), [], NO_LISTINGS)
}

export function useSavedPresets(): SavedPreset[] {
  return useLiveQuery(() => getDb().presets.orderBy('name').toArray(), [], NO_PRESETS)
}
