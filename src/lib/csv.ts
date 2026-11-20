/**
 * CSV export (SPEC §6.5). RFC 4180 quoting. Cells that start with = + - @ are prefixed
 * with ' so a spreadsheet does not run them as formulas (CSV injection).
 */
import type { Stay } from '@/types/domain'
import type { ExportFile } from '@/types/userData'

type Cell = string | number | boolean | null | undefined

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function listingsCsv(listings: readonly Stay[]): string {
  return toCsv(
    [
      'id',
      'name',
      'type',
      'campus',
      'distance_km',
      'locality',
      'rent',
      'deposit',
      'all_in_min',
      'all_in_max',
      'sharing',
      'food',
      'ac',
      'furnished',
      'gender',
      'phone',
      'url',
      'photo_url',
      'lat',
      'lng',
      'created_at',
    ],
    listings.map((s) => [
      s.id,
      s.name,
      s.type,
      s.nearestCollegeId,
      s.distanceKm,
      s.locality,
      s.rent,
      s.deposit,
      s.allInEstimate?.min,
      s.allInEstimate?.max,
      s.sharing,
      s.food,
      s.ac,
      s.furnished,
      s.gender,
      s.phone,
      s.url,
      s.photoUrl,
      s.lat,
      s.lng,
      s.createdAt,
    ]),
  )
}

/** One row per item that has a shortlist mark, note, status or checklist. */
export function ownerNotesCsv(file: ExportFile, nameOf: (key: string) => string): string {
  const keys = new Set([
    ...file.shortlist.map((x) => x.key),
    ...file.notes.map((x) => x.key),
    ...file.status.map((x) => x.key),
    ...file.checklist.map((x) => x.key),
  ])
  const rows = [...keys].sort().map((key) => {
    const cl = file.checklist.find((x) => x.key === key)
    const ticked = cl
      ? Object.entries(cl.items)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(' ')
      : ''
    return [
      key.split(':')[0],
      key.slice(key.indexOf(':') + 1),
      nameOf(key),
      file.shortlist.some((x) => x.key === key),
      file.status.find((x) => x.key === key)?.status ?? 'not_visited',
      file.notes.find((x) => x.key === key)?.text,
      ticked,
      cl?.note,
    ]
  })
  return toCsv(
    ['kind', 'id', 'name', 'shortlisted', 'status', 'note', 'checklist_done', 'checklist_note'],
    rows,
  )
}

/** Browser download of a text file. */
export function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
