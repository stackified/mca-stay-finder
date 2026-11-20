/**
 * IndexedDB via Dexie (SPEC §5, §6.5). Owner data only — never part of the build or the URL.
 * All writes go through these functions; components read with `useLiveQuery`.
 */
import Dexie, { type Table } from 'dexie'
import type { Stay } from '@/types/domain'
import {
  EXPORT_APP,
  EXPORT_VERSION,
  ExportFileSchema,
  entityKey,
  type ChecklistItem,
  type EntityKind,
  type ExportFile,
  type NoteItem,
  type SavedPreset,
  type ShortlistItem,
  type StatusItem,
  type VisitStatus,
} from '@/types/userData'

export class AppDB extends Dexie {
  shortlist!: Table<ShortlistItem, string>
  notes!: Table<NoteItem, string>
  status!: Table<StatusItem, string>
  checklist!: Table<ChecklistItem, string>
  presets!: Table<SavedPreset, string>
  listings!: Table<Stay, string>

  constructor(name = 'mca-stay-finder') {
    super(name)
    this.version(1).stores({
      shortlist: '&key, kind, addedAt',
      notes: '&key',
      status: '&key, status',
      checklist: '&key',
      presets: '&name',
      listings: '&id, nearestCollegeId',
    })
  }
}

let instance: AppDB | null = null
/** The app's database (created on first use). Tests pass their own AppDB instead. */
export const getDb = () => (instance ??= new AppDB())

const now = () => new Date().toISOString()

// ---------- Shortlist ----------

export async function toggleShortlist(db: AppDB, kind: EntityKind, id: string): Promise<boolean> {
  const key = entityKey(kind, id)
  const existing = await db.shortlist.get(key)
  if (existing) {
    await db.shortlist.delete(key)
    return false
  }
  await db.shortlist.put({ key, kind, id, addedAt: now() })
  return true
}

// ---------- Notes / status / checklist ----------

/** Empty text deletes the note. */
export async function setNote(db: AppDB, key: string, text: string) {
  if (text.trim() === '') await db.notes.delete(key)
  else await db.notes.put({ key, text, updatedAt: now() })
}

/** "not_visited" is the default, so it is stored as "no row". */
export async function setStatus(db: AppDB, key: string, status: VisitStatus) {
  if (status === 'not_visited') await db.status.delete(key)
  else await db.status.put({ key, status, updatedAt: now() })
}

export async function setChecklist(
  db: AppDB,
  key: string,
  patch: { items?: Record<string, boolean>; note?: string },
) {
  const prev = await db.checklist.get(key)
  await db.checklist.put({
    key,
    items: { ...prev?.items, ...patch.items },
    note: patch.note ?? prev?.note,
    updatedAt: now(),
  })
}

// ---------- Listings ----------

export async function saveListing(db: AppDB, listing: Stay) {
  if (listing.source !== 'mine') throw new Error('Only own listings can be saved')
  await db.listings.put({ ...listing, updatedAt: now() })
}

/** Deletes the listing and everything attached to it. */
export async function deleteListing(db: AppDB, id: string) {
  const key = entityKey('stay', id)
  await db.transaction(
    'rw',
    [db.listings, db.shortlist, db.notes, db.status, db.checklist],
    async () => {
      await db.listings.delete(id)
      await db.shortlist.delete(key)
      await db.notes.delete(key)
      await db.status.delete(key)
      await db.checklist.delete(key)
    },
  )
}

// ---------- Presets ----------

export async function savePreset(db: AppDB, name: string, query: string) {
  await db.presets.put({ name: name.trim(), query, savedAt: now() })
}

// ---------- Export / import ----------

export async function exportAll(db: AppDB): Promise<ExportFile> {
  const [shortlist, notes, status, checklist, presets, myListings] = await Promise.all([
    db.shortlist.toArray(),
    db.notes.toArray(),
    db.status.toArray(),
    db.checklist.toArray(),
    db.presets.toArray(),
    db.listings.toArray(),
  ])
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: now(),
    shortlist,
    notes,
    status,
    checklist,
    presets,
    myListings,
  }
}

export type ImportSummary = Record<
  'shortlist' | 'notes' | 'status' | 'checklist' | 'presets' | 'myListings',
  number
>

/**
 * Validates the file first; on any error nothing is written. Then replaces ALL owner data
 * in one transaction (so a failed import cannot leave half the data).
 */
export async function importAll(db: AppDB, raw: unknown): Promise<ImportSummary> {
  const file = ExportFileSchema.parse(raw)
  await db.transaction(
    'rw',
    [db.shortlist, db.notes, db.status, db.checklist, db.presets, db.listings],
    async () => {
      await Promise.all([
        db.shortlist.clear(),
        db.notes.clear(),
        db.status.clear(),
        db.checklist.clear(),
        db.presets.clear(),
        db.listings.clear(),
      ])
      await db.shortlist.bulkPut(file.shortlist)
      await db.notes.bulkPut(file.notes)
      await db.status.bulkPut(file.status)
      await db.checklist.bulkPut(file.checklist)
      await db.presets.bulkPut(file.presets)
      await db.listings.bulkPut(file.myListings)
    },
  )
  return {
    shortlist: file.shortlist.length,
    notes: file.notes.length,
    status: file.status.length,
    checklist: file.checklist.length,
    presets: file.presets.length,
    myListings: file.myListings.length,
  }
}
