import { useEffect, useId, useState } from 'react'
import { Star } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getDb, setChecklist, setNote, setStatus, toggleShortlist } from '@/store/db'
import { useChecklist, useNote, useShortlistKeys, useStatusMap } from '@/store/useOwnerData'
import {
  CHECKLIST_ITEMS,
  VISIT_STATUS_LABEL,
  VisitStatusSchema,
  entityKey,
  type EntityKind,
  type VisitStatus,
} from '@/types/userData'

/** ★ toggle (SPEC §6.5 Shortlist). Persists in IndexedDB. */
export function ShortlistStar({
  kind,
  id,
  name,
  className,
}: {
  kind: EntityKind
  id: string
  name: string
  className?: string
}) {
  const on = useShortlistKeys().has(entityKey(kind, id))
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from shortlist` : `Add ${name} to shortlist`}
      title={on ? 'Shortlisted — click to remove' : 'Add to shortlist'}
      onClick={(e) => {
        e.stopPropagation()
        void toggleShortlist(getDb(), kind, id)
      }}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-muted focus-visible:outline-2 focus-visible:outline-blue-600',
        className,
      )}
    >
      <Star
        className={cn('size-4', on ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')}
      />
    </button>
  )
}

/**
 * Note box that saves after typing stops (and on blur).
 * Shows `draft ?? saved`: while typing, the draft; otherwise the stored note (so a change made
 * elsewhere, such as an import, shows at once without copying it into state).
 */
function NoteBox({ storeKey, label }: { storeKey: string; label: string }) {
  const saved = useNote(storeKey)
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()
  const save = (text: string) => void setNote(getDb(), storeKey, text).then(() => setDraft(null))
  useEffect(() => {
    if (draft === null) return
    const t = setTimeout(() => save(draft), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save is recreated each render
  }, [draft, storeKey])
  return (
    <div>
      <Label htmlFor={id} className="mb-1 text-xs">
        {label}
        {draft !== null && (
          <span className="ml-1 font-normal text-muted-foreground">(saving…)</span>
        )}
      </Label>
      <Textarea
        id={id}
        value={draft ?? saved}
        rows={2}
        placeholder="Your notes (saved on this device)"
        className="min-h-12 text-xs"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== null && save(draft)}
      />
    </div>
  )
}

function ChecklistBox({ storeKey }: { storeKey: string }) {
  const cl = useChecklist(storeKey)
  const id = useId()
  const done = CHECKLIST_ITEMS.filter((i) => cl?.items[i.id]).length
  return (
    <details className="rounded border px-2 py-1">
      <summary className="cursor-pointer text-xs font-medium">
        Visit checklist ({done}/{CHECKLIST_ITEMS.length})
      </summary>
      <ul className="mt-1 grid grid-cols-2 gap-1">
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item.id} className="flex items-center gap-1.5">
            <Checkbox
              id={`${id}-${item.id}`}
              checked={!!cl?.items[item.id]}
              onCheckedChange={(v) =>
                void setChecklist(getDb(), storeKey, { items: { [item.id]: v === true } })
              }
            />
            <Label htmlFor={`${id}-${item.id}`} className="text-[11px] font-normal">
              {item.label}
            </Label>
          </li>
        ))}
      </ul>
      <ChecklistNote storeKey={storeKey} saved={cl?.note ?? ''} />
    </details>
  )
}

function ChecklistNote({ storeKey, saved }: { storeKey: string; saved: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()
  const text = draft ?? saved
  return (
    <div className="mt-1">
      <Label htmlFor={id} className="sr-only">
        Checklist note
      </Label>
      <Textarea
        id={id}
        value={text}
        rows={1}
        placeholder="Visit findings (e.g. Wi-Fi 40 Mbps, 2 h power cut)"
        className="min-h-8 text-[11px]"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== saved) {
            void setChecklist(getDb(), storeKey, { note: draft }).then(() => setDraft(null))
          } else {
            setDraft(null)
          }
        }}
      />
    </div>
  )
}

/**
 * Shortlist ★, visit status, notes and visit checklist for one college or stay (SPEC §6.5).
 * Everything is stored on this device only (IndexedDB) and exported via Export.
 */
export function OwnerControls({ kind, id, name }: { kind: EntityKind; id: string; name: string }) {
  const key = entityKey(kind, id)
  const status = useStatusMap().get(key) ?? 'not_visited'
  const statusId = useId()
  return (
    <section aria-label={`Your notes for ${name}`} className="mt-2 space-y-1.5 border-t pt-2">
      <div className="flex items-center gap-2">
        <ShortlistStar kind={kind} id={id} name={name} />
        <Label htmlFor={statusId} className="text-xs">
          Status
        </Label>
        <select
          id={statusId}
          value={status}
          onChange={(e) =>
            void setStatus(getDb(), key, VisitStatusSchema.parse(e.target.value) as VisitStatus)
          }
          className="h-7 flex-1 rounded border bg-background px-1 text-xs"
        >
          {VisitStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {VISIT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <NoteBox storeKey={key} label="Notes" />
      <ChecklistBox storeKey={key} />
    </section>
  )
}
