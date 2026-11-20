import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAppStore } from '@/store/useAppStore'
import { useListings } from '@/store/useOwnerData'

const fmt = (iso: string | undefined) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: iso.length > 10 ? 'short' : undefined,
      })
    : '—'

const CONFIDENCE = [
  [
    'O',
    'Official',
    'NIMCET seat matrix, CPCB bulletins, VITMEE brochure',
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  ],
  [
    'A',
    'Aggregator',
    'Shiksha, Collegedunia, Careers360 … — replace with NIRF/college reports when you can',
    'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100',
  ],
  [
    'E',
    'Estimate',
    'Market-rate estimates, modelled live AQI, derived values',
    'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  ],
  ['–', 'No data', 'Nothing reliable found yet', 'bg-muted text-muted-foreground'],
] as const

/** SPEC §17 caveats, always available here. */
const CAVEATS = [
  'Costs are estimates, not live listings — verify on rental sites and during the campus visit.',
  'Placement figures vary by source and year; official reports beat aggregators.',
  'Several NIT MCAs now run 3 years — the budget calculator supports 2 or 3 years.',
  'OpenStreetMap maps very few PGs in India (6 in this data) — your own listings are the real source.',
  'Live AQI from Open-Meteo is modelled (CAMS), not a CPCB station reading.',
  'Campus coordinates were checked with Nominatim; NIT Patna and the IIITs are still approximate.',
]

/** "?" button: data sources & dates (SPEC §6.5 Data info), confidence legend, caveats, help. */
export function DataInfoDialog() {
  const data = useAppStore((s) => s.data)
  const live = useAppStore((s) => s.live.result)
  const listings = useListings()
  const rows: [string, string, string, string][] = data
    ? [
        [
          'Colleges (seats, placements, scores)',
          `${data.colleges.data.length} colleges`,
          fmt(data.colleges.meta.generatedAt),
          data.colleges.meta.sources.join(' · '),
        ],
        [
          'Cities (annual AQI, costs, living)',
          `${data.cities.data.length} cities`,
          fmt(data.cities.meta.generatedAt),
          data.cities.meta.sources.join(' · '),
        ],
        [
          'Localities near campuses',
          `${data.localities.data.length} localities`,
          fmt(data.localities.meta.generatedAt),
          data.localities.meta.sources.join(' · '),
        ],
        [
          'Places to stay (OpenStreetMap)',
          data.stays ? `${data.stays.data.length} places` : 'not loaded',
          fmt(data.stays?.meta.generatedAt),
          data.stays?.meta.sources.join(' · ') ?? '—',
        ],
        [
          'Amenities (OpenStreetMap, 5 km)',
          data.amenities
            ? `${Object.values(data.amenities.byCampus).reduce((s, r) => s + r.length, 0)} amenities`
            : 'not loaded',
          fmt(data.amenities?.meta.generatedAt),
          data.amenities?.meta.sources.join(' · ') ?? '—',
        ],
        [
          'Live AQI + weather',
          live?.data
            ? `${Object.keys(live.data.byCity).length} cities · ${live.source}`
            : (live?.source ?? 'loading'),
          fmt(live?.data?.fetchedAt),
          'Open-Meteo (CAMS model, CC BY 4.0)',
        ],
        [
          'Your listings & notes',
          `${listings.length} listings`,
          'this device',
          'IndexedDB in this browser only — use Export to back up',
        ],
        ['Map', 'tiles', 'live', '© OpenStreetMap contributors · OpenFreeMap · OpenMapTiles'],
      ]
    : []

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Data sources, dates and help">
          <Info />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Data sources &amp; dates</DialogTitle>
          <DialogDescription>
            Every number in the app carries a badge — hover or focus it for its source and date.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Datasets">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2">Dataset</th>
                <th className="py-1 pr-2">Size</th>
                <th className="py-1 pr-2">Last refresh</th>
                <th className="py-1">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([name, size, when, src]) => (
                <tr key={name} className="align-top">
                  <th scope="row" className="py-1 pr-2 text-left font-medium">
                    {name}
                  </th>
                  <td className="py-1 pr-2 whitespace-nowrap">{size}</td>
                  <td className="py-1 pr-2 whitespace-nowrap">{when}</td>
                  <td className="py-1 text-muted-foreground">{src}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section aria-labelledby="conf-h" className="text-xs">
          <h3 id="conf-h" className="mb-1 font-semibold">
            Confidence badges
          </h3>
          <ul className="space-y-1">
            {CONFIDENCE.map(([letter, label, text, cls]) => (
              <li key={label} className="flex items-start gap-2">
                <span
                  className={`inline-flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${cls}`}
                  aria-hidden
                >
                  {letter}
                </span>
                <span>
                  <span className="font-medium">{label}</span> — {text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="cav-h" className="text-xs">
          <h3 id="cav-h" className="mb-1 font-semibold">
            Keep in mind
          </h3>
          <ul className="list-disc space-y-0.5 pl-4">
            {CAVEATS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="help-h" className="text-xs">
          <h3 id="help-h" className="mb-1 font-semibold">
            Using the app
          </h3>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              Every filter updates the map, the ranking and the charts at once. The URL keeps the
              whole view — bookmark it.
            </li>
            <li>
              Keyboard: Tab moves through filters; arrow keys move sliders; Enter on a ranked row or
              a map marker selects it; Esc closes popups and dialogs.
            </li>
            <li>Click a college to draw the stay ring; the Stays tab lists what is inside it.</li>
            <li>
              Nothing leaves this device except map, Open-Meteo and place-search requests. No
              analytics, no accounts.
            </li>
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  )
}
