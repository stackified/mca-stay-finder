import { AMENITY_COLOR, AMENITY_KINDS, AMENITY_LABEL, AMENITY_SYMBOL } from '@/lib/amenities'
import { NAQI_BANDS } from '@/lib/naqi'
import { SCORE_BAND_STYLE, type ScoreBand } from '@/lib/scoring'
import { ALL_STAY_TYPES, STAY_TYPE_COLOR, STAY_TYPE_LABEL, STAY_TYPE_SYMBOL } from '@/lib/stays'

export type LayerVisibility = {
  cityAqi: boolean
  colleges: boolean
  stays: boolean
  localities: boolean
  amenities: boolean
}

const LAYERS: { key: keyof LayerVisibility; label: string }[] = [
  { key: 'colleges', label: 'Colleges' },
  { key: 'stays', label: 'Stays (clustered)' },
  { key: 'localities', label: 'Localities (selected campus)' },
  { key: 'amenities', label: 'Amenities (selected campus)' },
  { key: 'cityAqi', label: 'City air quality' },
]

const SCORE_ORDER: ScoreBand[] = ['high', 'mid', 'low', 'none']

function Swatch({ color, dashed = false }: { color?: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        dashed
          ? 'inline-block size-2.5 shrink-0 rounded-full border-2 border-dashed border-gray-900'
          : 'inline-block size-2.5 shrink-0 rounded-full'
      }
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

/**
 * Layer toggles + legend (SPEC §6.3: "always visible").
 * Sits top-left, over Pakistan/Afghanistan, where no campus markers are.
 * It can be collapsed with its summary.
 */
export function Legend({
  layers,
  onChange,
  defaultOpen,
  aqiMode,
  onAqiModeChange,
  liveAvailable,
}: {
  layers: LayerVisibility
  onChange: (next: LayerVisibility) => void
  defaultOpen: boolean
  aqiMode: 'annual' | 'live'
  onAqiModeChange: (mode: 'annual' | 'live') => void
  liveAvailable: boolean
}) {
  return (
    <details
      open={defaultOpen}
      className="group absolute top-2 left-2 z-10 max-h-[calc(100%-1rem)] w-48 overflow-x-hidden overflow-y-auto rounded-md border bg-background/95 px-2 py-1.5 text-[10.5px] leading-tight shadow-md"
    >
      <summary className="cursor-pointer font-semibold select-none group-open:mb-1">
        Layers &amp; legend
      </summary>

      <fieldset className="mb-1.5 space-y-0.5">
        <legend className="sr-only">Layers</legend>
        {LAYERS.map((l) => (
          <label key={l.key} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={layers[l.key]}
              onChange={(e) => onChange({ ...layers, [l.key]: e.target.checked })}
            />
            {l.label}
          </label>
        ))}
      </fieldset>

      {layers.colleges && (
        <div className="mb-1.5">
          <p className="font-semibold">College score</p>
          <ul className="grid grid-cols-2 gap-x-2">
            {SCORE_ORDER.map((b) => (
              <li key={b} className="flex items-center gap-1">
                <Swatch color={SCORE_BAND_STYLE[b].color} />
                {SCORE_BAND_STYLE[b].label}
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1">
            <Swatch dashed /> VIT backup · size = seats
          </p>
        </div>
      )}

      {layers.stays && (
        <div className="mb-1.5">
          <p className="font-semibold">Stays</p>
          <ul>
            {ALL_STAY_TYPES.map((t) => (
              <li key={t} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-flex size-3 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ backgroundColor: STAY_TYPE_COLOR[t] }}
                >
                  {STAY_TYPE_SYMBOL[t]}
                </span>
                {STAY_TYPE_LABEL[t]}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">Dashed ring = max distance</p>
        </div>
      )}

      {layers.amenities && (
        <div className="mb-1.5">
          <p className="font-semibold">Amenities (5 km)</p>
          <ul className="grid grid-cols-2 gap-x-2">
            {AMENITY_KINDS.map((k) => (
              <li key={k} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-flex h-3 min-w-3 items-center justify-center rounded-sm px-0.5 text-[7px] font-bold text-white"
                  style={{ backgroundColor: AMENITY_COLOR[k] }}
                >
                  {AMENITY_SYMBOL[k]}
                </span>
                {AMENITY_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {layers.cityAqi && (
        <div>
          <fieldset className="mb-0.5 flex items-center gap-2">
            <legend className="sr-only">Air quality shown</legend>
            <span className="font-semibold">Indian NAQI</span>
            {(['annual', 'live'] as const).map((m) => (
              <label key={m} className="flex items-center gap-0.5">
                <input
                  type="radio"
                  name="aqi-mode"
                  checked={aqiMode === m}
                  disabled={m === 'live' && !liveAvailable}
                  onChange={() => onAqiModeChange(m)}
                />
                {m === 'annual' ? 'Annual' : 'Live 24 h'}
              </label>
            ))}
          </fieldset>
          {aqiMode === 'live' && (
            <p className="mb-0.5 text-muted-foreground">Open-Meteo CAMS model, not CPCB stations</p>
          )}
          <ul>
            {NAQI_BANDS.map((b, i) => (
              <li key={b.band} className="flex items-center gap-1">
                <Swatch color={b.color} />
                {b.band}
                <span className="ml-auto text-muted-foreground">
                  {i === 0 ? 0 : NAQI_BANDS[i - 1]!.max + 1}–{b.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  )
}
