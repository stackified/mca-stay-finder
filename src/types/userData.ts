/**
 * Owner data kept in IndexedDB (SPEC §8 UserState, §6.5). Never bundled into the build.
 * The export file is validated with these schemas before an import touches the database.
 */
import { z } from 'zod'
import { StaySchema } from './domain'

export const EntityKindSchema = z.enum(['college', 'stay', 'city'])
export type EntityKind = z.infer<typeof EntityKindSchema>

/** "college:nit-warangal", "stay:osm-way-123", "stay:mine-…". */
export const entityKey = (kind: EntityKind, id: string) => `${kind}:${id}`

export const VisitStatusSchema = z.enum(['not_visited', 'shortlisted', 'visited', 'rejected'])
export type VisitStatus = z.infer<typeof VisitStatusSchema>
export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  not_visited: 'Not visited',
  shortlisted: 'Shortlisted',
  visited: 'Visited',
  rejected: 'Rejected',
}

export const ShortlistItemSchema = z.object({
  key: z.string(),
  kind: EntityKindSchema,
  id: z.string(),
  addedAt: z.string(),
})
export type ShortlistItem = z.infer<typeof ShortlistItemSchema>

export const NoteItemSchema = z.object({ key: z.string(), text: z.string(), updatedAt: z.string() })
export type NoteItem = z.infer<typeof NoteItemSchema>

export const StatusItemSchema = z.object({
  key: z.string(),
  status: VisitStatusSchema,
  updatedAt: z.string(),
})
export type StatusItem = z.infer<typeof StatusItemSchema>

/** SPEC §6.5 visit checklist. */
export const CHECKLIST_ITEMS = [
  { id: 'water', label: 'Water supply' },
  { id: 'power', label: 'Power backup' },
  { id: 'wifi', label: 'Wi-Fi speed' },
  { id: 'food', label: 'Food quality' },
  { id: 'safety', label: 'Safety' },
  { id: 'noise', label: 'Noise' },
  { id: 'commute', label: 'Commute test' },
  { id: 'hostel', label: 'Hostel inspection' },
] as const

export const ChecklistItemSchema = z.object({
  key: z.string(),
  items: z.record(z.string(), z.boolean()),
  note: z.string().optional(),
  updatedAt: z.string(),
})
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>

/** Filters/weights are stored as the URL query string: compact and already validated on read. */
export const SavedPresetSchema = z.object({
  name: z.string().min(1).max(60),
  query: z.string(),
  savedAt: z.string(),
})
export type SavedPreset = z.infer<typeof SavedPresetSchema>

export const ListingSchema = StaySchema.refine((s) => s.source === 'mine', {
  message: 'Own listings must have source "mine"',
})

export const EXPORT_APP = 'mca-stay-finder'
export const EXPORT_VERSION = 1

export const ExportFileSchema = z.object({
  app: z.literal(EXPORT_APP),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  shortlist: z.array(ShortlistItemSchema),
  notes: z.array(NoteItemSchema),
  status: z.array(StatusItemSchema),
  checklist: z.array(ChecklistItemSchema),
  presets: z.array(SavedPresetSchema),
  myListings: z.array(ListingSchema),
})
export type ExportFile = z.infer<typeof ExportFileSchema>
