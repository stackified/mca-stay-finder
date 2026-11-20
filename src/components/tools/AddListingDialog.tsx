import { useId, useState, type ReactNode } from 'react'
import { MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchPlaces, type PlaceHit } from '@/lib/api/nominatim'
import { haversineKm } from '@/lib/geo'
import { buildListing, type ListingInput } from '@/lib/listings'
import { ALL_STAY_TYPES, STAY_TYPE_LABEL } from '@/lib/stays'
import { getDb, saveListing } from '@/store/db'
import { useAppStore, type ListingDraft } from '@/store/useAppStore'

function Field({
  label,
  children,
  htmlFor,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  )
}

const selectCls = 'h-8 w-full rounded-md border bg-background px-2 text-xs'

const num = (s: string): number | undefined => {
  const t = s.replace(/[,₹\s]/g, '')
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}
const yn = (v: '' | 'yes' | 'no') => (v === '' ? undefined : v === 'yes')

/** Draft → validated ListingInput, or a list of problems to show. */
function toInput(d: ListingDraft): { input?: ListingInput; errors: string[] } {
  const errors: string[] = []
  if (!d.name.trim()) errors.push('Title is required.')
  if (!d.collegeId) errors.push('Choose the campus it is near.')
  if (d.lat === undefined || d.lng === undefined)
    errors.push('Set the location (search or click the map).')
  const rent = num(d.rent)
  const deposit = num(d.deposit)
  if (Number.isNaN(rent)) errors.push('Rent must be a number in ₹.')
  if (Number.isNaN(deposit)) errors.push('Deposit must be a number in ₹.')
  if (errors.length) return { errors }
  return {
    errors,
    input: {
      name: d.name,
      type: d.type,
      collegeId: d.collegeId,
      lat: d.lat!,
      lng: d.lng!,
      locality: d.locality,
      rent,
      deposit,
      sharing: d.sharing || undefined,
      food: yn(d.food),
      ac: yn(d.ac),
      furnished: d.furnished || undefined,
      gender: d.gender || undefined,
      phone: d.phone,
      url: d.url,
      photoUrl: d.photoUrl,
    },
  }
}

/** "Add my listing" (SPEC §6.5). Saved in IndexedDB; appears on the map at once. */
export function AddListingDialog() {
  const form = useAppStore((s) => s.listingForm)
  const update = useAppStore((s) => s.updateListingDraft)
  const close = useAppStore((s) => s.closeListingForm)
  const startPick = useAppStore((s) => s.startPickLocation)
  const selectCollege = useAppStore((s) => s.selectCollege)
  const selectStay = useAppStore((s) => s.selectStay)
  const setResultsTab = useAppStore((s) => s.setResultsTab)
  const data = useAppStore((s) => s.data)
  const d = form.draft
  const id = useId()
  const f = (name: string) => `${id}-${name}`

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const colleges = data?.colleges.data ?? []
  const campus = colleges.find((c) => c.id === d.collegeId)
  const distance =
    campus && d.lat !== undefined && d.lng !== undefined
      ? haversineKm(campus, { lat: d.lat, lng: d.lng })
      : null

  const onSearch = async () => {
    setSearching(true)
    setMessage(null)
    try {
      const q =
        campus && !/,/.test(query) ? `${query}, ${campus.name.replace(/\s*\(.*\)$/, '')}` : query
      const r = await searchPlaces(q, campus)
      setHits(r)
      if (r.length === 0) setMessage('No match. Try a shorter name, or click the map.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }

  const onSave = async () => {
    const { input, errors: errs } = toInput(d)
    setErrors(errs)
    if (!input || !campus) return
    const city = data?.cities.data.find((c) => c.id === campus.cityId)
    const listing = buildListing(input, campus, city, { id: d.editId, createdAt: d.createdAt })
    await saveListing(getDb(), listing)
    close()
    // Show it: select its campus, open the Stays tab and its popup.
    selectCollege(campus.id)
    setResultsTab('stays')
    selectStay(listing.id)
  }

  return (
    <Dialog open={form.open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{d.editId ? 'Edit my listing' : 'Add my listing'}</DialogTitle>
          <DialogDescription>
            Saved only on this device (IndexedDB). Use Export to keep a copy.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Title *" htmlFor={f('name')}>
              <Input
                id={f('name')}
                value={d.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="e.g. Sri Sai Boys PG"
                className="h-8 text-xs"
              />
            </Field>
          </div>
          <Field label="Type *" htmlFor={f('type')}>
            <select
              id={f('type')}
              className={selectCls}
              value={d.type}
              onChange={(e) => update({ type: e.target.value as ListingDraft['type'] })}
            >
              {ALL_STAY_TYPES.filter((t) => t !== 'unknown').map((t) => (
                <option key={t} value={t}>
                  {STAY_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Near campus *" htmlFor={f('campus')}>
            <select
              id={f('campus')}
              className={selectCls}
              value={d.collegeId}
              onChange={(e) => update({ collegeId: e.target.value })}
            >
              <option value="">Choose…</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="col-span-2 space-y-2 rounded-md border p-2">
            <legend className="px-1 text-xs font-medium">Location *</legend>
            <div className="flex gap-1">
              <Label htmlFor={f('q')} className="sr-only">
                Search a place
              </Label>
              <Input
                id={f('q')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onSearch()
                  }
                }}
                placeholder="Search a place or locality (OpenStreetMap)"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={searching || query.trim().length < 3}
                onClick={() => void onSearch()}
              >
                <Search /> {searching ? '…' : 'Search'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={startPick}>
                <MapPin /> Pick on map
              </Button>
            </div>
            {message && (
              <p className="text-[11px] text-muted-foreground" role="status">
                {message}
              </p>
            )}
            {hits.length > 0 && (
              <ul
                className="max-h-32 space-y-0.5 overflow-y-auto text-[11px]"
                aria-label="Search results"
              >
                {hits.map((h) => (
                  <li key={`${h.lat},${h.lng}`}>
                    <button
                      type="button"
                      className="w-full rounded px-1 py-0.5 text-left hover:bg-muted"
                      onClick={() => {
                        update({ lat: h.lat, lng: h.lng })
                        setHits([])
                      }}
                    >
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px]">
              {d.lat !== undefined && d.lng !== undefined ? (
                <>
                  Set: {d.lat.toFixed(5)}, {d.lng.toFixed(5)}
                  {distance !== null && ` · ${distance.toFixed(1)} km from ${campus?.name}`}
                  {distance !== null && distance > 25 && (
                    <span className="ml-1 font-medium text-destructive">
                      — far from this campus; check the point.
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not set yet.</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Search results © OpenStreetMap contributors (Nominatim).
            </p>
          </fieldset>

          <Field label="Locality" htmlFor={f('loc')}>
            <Input
              id={f('loc')}
              value={d.locality}
              onChange={(e) => update({ locality: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Rent ₹/month" htmlFor={f('rent')}>
            <Input
              id={f('rent')}
              inputMode="numeric"
              value={d.rent}
              onChange={(e) => update({ rent: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Deposit ₹" htmlFor={f('dep')}>
            <Input
              id={f('dep')}
              inputMode="numeric"
              value={d.deposit}
              onChange={(e) => update({ deposit: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Sharing" htmlFor={f('share')}>
            <select
              id={f('share')}
              className={selectCls}
              value={d.sharing}
              onChange={(e) => update({ sharing: e.target.value as ListingDraft['sharing'] })}
            >
              <option value="">—</option>
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="triple">Triple</option>
            </select>
          </Field>
          <Field label="Food included" htmlFor={f('food')}>
            <select
              id={f('food')}
              className={selectCls}
              value={d.food}
              onChange={(e) => update({ food: e.target.value as ListingDraft['food'] })}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="AC" htmlFor={f('ac')}>
            <select
              id={f('ac')}
              className={selectCls}
              value={d.ac}
              onChange={(e) => update({ ac: e.target.value as ListingDraft['ac'] })}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Furnished" htmlFor={f('furn')}>
            <select
              id={f('furn')}
              className={selectCls}
              value={d.furnished}
              onChange={(e) => update({ furnished: e.target.value as ListingDraft['furnished'] })}
            >
              <option value="">—</option>
              <option value="none">Unfurnished</option>
              <option value="semi">Semi</option>
              <option value="full">Fully</option>
            </select>
          </Field>
          <Field label="Gender" htmlFor={f('gender')}>
            <select
              id={f('gender')}
              className={selectCls}
              value={d.gender}
              onChange={(e) => update({ gender: e.target.value as ListingDraft['gender'] })}
            >
              <option value="">—</option>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="coliving">Co-living</option>
              <option value="any">Any</option>
            </select>
          </Field>
          <Field label="Contact (optional)" htmlFor={f('phone')}>
            <Input
              id={f('phone')}
              value={d.phone}
              onChange={(e) => update({ phone: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="Source URL" htmlFor={f('url')}>
            <Input
              id={f('url')}
              type="url"
              value={d.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://…"
              className="h-8 text-xs"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Photo URL" htmlFor={f('photo')}>
              <Input
                id={f('photo')}
                type="url"
                value={d.photoUrl}
                onChange={(e) => update({ photoUrl: e.target.value })}
                placeholder="https://…"
                className="h-8 text-xs"
              />
            </Field>
          </div>
        </div>

        {errors.length > 0 && (
          <ul role="alert" className="list-disc pl-5 text-xs text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()}>{d.editId ? 'Save changes' : 'Add listing'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
