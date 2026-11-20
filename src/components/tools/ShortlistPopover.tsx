import { Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getDb, toggleShortlist } from '@/store/db'
import { useAppStore } from '@/store/useAppStore'
import { useListings, useShortlist, useStatusMap } from '@/store/useOwnerData'
import { VISIT_STATUS_LABEL, type ShortlistItem } from '@/types/userData'

/** Top-bar shortlist (SPEC §6.5): every ★ item, with status; click to show it on the map. */
export function ShortlistPopover() {
  const items = useShortlist()
  const status = useStatusMap()
  const listings = useListings()
  const data = useAppStore((s) => s.data)
  const selectCollege = useAppStore((s) => s.selectCollege)
  const selectStay = useAppStore((s) => s.selectStay)
  const setTab = useAppStore((s) => s.setResultsTab)

  const stayOf = (id: string) =>
    listings.find((x) => x.id === id) ?? data?.stays?.data.find((x) => x.id === id)
  const nameOf = (it: ShortlistItem) =>
    it.kind === 'college'
      ? (data?.colleges.data.find((c) => c.id === it.id)?.name ?? it.id)
      : (stayOf(it.id)?.name ?? `${it.id} (not in current data)`)

  const open = (it: ShortlistItem) => {
    if (it.kind === 'college') {
      selectCollege(it.id)
      setTab('ranked')
      return
    }
    const s = stayOf(it.id)
    if (!s) return
    selectCollege(s.nearestCollegeId)
    setTab('stays')
    selectStay(s.id)
  }

  const groups = [
    { title: 'Colleges', rows: items.filter((x) => x.kind === 'college') },
    { title: 'Stays', rows: items.filter((x) => x.kind === 'stay') },
  ]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Star className={items.length ? 'fill-amber-400 text-amber-500' : ''} />
          Shortlist ({items.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        {items.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">
            Nothing yet. Use ★ on a college or stay to add it.
          </p>
        ) : (
          groups.map(
            (g) =>
              g.rows.length > 0 && (
                <section key={g.title} className="mb-2">
                  <h3 className="mb-1 px-1 text-xs font-semibold">{g.title}</h3>
                  <ul className="space-y-0.5">
                    {g.rows.map((it) => {
                      const st = status.get(it.key)
                      return (
                        <li key={it.key} className="flex items-center gap-1">
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
                            onClick={() => open(it)}
                          >
                            {nameOf(it)}
                            {st && (
                              <span className="ml-1 text-muted-foreground">
                                · {VISIT_STATUS_LABEL[st]}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${nameOf(it)} from shortlist`}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                            onClick={() => void toggleShortlist(getDb(), it.kind, it.id)}
                          >
                            <X className="size-3" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ),
          )
        )}
      </PopoverContent>
    </Popover>
  )
}
