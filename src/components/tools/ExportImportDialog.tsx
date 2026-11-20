import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { ZodError } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { downloadText, listingsCsv, ownerNotesCsv } from '@/lib/csv'
import { exportAll, getDb, importAll, type ImportSummary } from '@/store/db'
import { useAppStore } from '@/store/useAppStore'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Export / import of shortlist, notes, status, checklist, custom presets and own listings
 * (SPEC §6.5). JSON round-trips everything; CSV is for spreadsheets (export only).
 */
export function ExportImportDialog() {
  const data = useAppStore((s) => s.data)
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const nameOf = (key: string) => {
    const [kind, ...rest] = key.split(':')
    const id = rest.join(':')
    if (kind === 'college') return data?.colleges.data.find((c) => c.id === id)?.name ?? id
    return data?.stays?.data.find((s) => s.id === id)?.name ?? id
  }

  const exportJson = async () => {
    const file = await exportAll(getDb())
    downloadText(
      `mca-stay-finder-${today()}.json`,
      JSON.stringify(file, null, 2),
      'application/json',
    )
  }
  const exportListingsCsv = async () => {
    const file = await exportAll(getDb())
    downloadText(`my-listings-${today()}.csv`, listingsCsv(file.myListings), 'text/csv')
  }
  const exportNotesCsv = async () => {
    const file = await exportAll(getDb())
    const listingName = new Map(file.myListings.map((l) => [`stay:${l.id}`, l.name]))
    downloadText(
      `shortlist-notes-${today()}.csv`,
      ownerNotesCsv(file, (k) => listingName.get(k) ?? nameOf(k)),
      'text/csv',
    )
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setResult(null)
    try {
      const raw: unknown = JSON.parse(await f.text())
      if (
        !window.confirm(
          `Replace ALL your saved shortlist, notes, status, checklists, presets and listings on this device with "${f.name}"? Export first if you want to keep the current data.`,
        )
      ) {
        return
      }
      const s: ImportSummary = await importAll(getDb(), raw)
      setResult({
        ok: true,
        text: `Imported ${s.myListings} listings, ${s.shortlist} shortlist items, ${s.notes} notes, ${s.status} statuses, ${s.checklist} checklists, ${s.presets} presets.`,
      })
    } catch (e) {
      const why =
        e instanceof SyntaxError
          ? 'The file is not valid JSON.'
          : e instanceof ZodError
            ? `The file is not an MCA Stay Finder export: ${e.issues[0]?.path.join('.') || 'root'} — ${e.issues[0]?.message}`
            : e instanceof Error
              ? e.message
              : String(e)
      setResult({ ok: false, text: `Nothing was imported. ${why}` })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog onOpenChange={() => setResult(null)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Download />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export / import your data</DialogTitle>
          <DialogDescription>
            Shortlist, notes, visit status, checklists, custom presets and your listings live only
            in this browser. Export them to keep a backup or move to another device.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <p className="font-medium">Export</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void exportJson()}>
                Everything (JSON)
              </Button>
              <Button size="sm" variant="outline" onClick={() => void exportListingsCsv()}>
                My listings (CSV)
              </Button>
              <Button size="sm" variant="outline" onClick={() => void exportNotesCsv()}>
                Shortlist &amp; notes (CSV)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Only the JSON file can be imported again. CSV files are for spreadsheets.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="font-medium">Import (JSON)</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              id="import-file"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload />
              Choose file…
            </Button>
            <p className="text-xs text-muted-foreground">
              Import replaces all saved data. The file is checked first; if anything is wrong,
              nothing changes.
            </p>
          </div>
          {result && (
            <p
              role="status"
              className={
                result.ok
                  ? 'text-xs text-emerald-700 dark:text-emerald-400'
                  : 'text-xs text-destructive'
              }
            >
              {result.text}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
