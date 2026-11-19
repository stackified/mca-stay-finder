import { NAQI_BANDS } from '@/lib/naqi'
import { SCORE_BAND_STYLE, type ScoreBand } from '@/lib/scoring'

export type LayerVisibility = { cityAqi: boolean; colleges: boolean }

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
}: {
  layers: LayerVisibility
  onChange: (next: LayerVisibility) => void
  defaultOpen: boolean
}) {
  return (
    <details
      open={defaultOpen}
      className="group absolute top-2 left-2 z-10 max-h-[calc(100%-1rem)] w-44 overflow-x-hidden overflow-y-auto rounded-md border bg-background/95 px-2 py-1.5 text-[10.5px] leading-tight shadow-md"
    >
      <summary className="cursor-pointer font-semibold select-none group-open:mb-1">
        Layers &amp; legend
      </summary>

      <fieldset className="mb-1.5 space-y-0.5">
        <legend className="sr-only">Layers</legend>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={layers.colleges}
            onChange={(e) => onChange({ ...layers, colleges: e.target.checked })}
          />
          Colleges
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={layers.cityAqi}
            onChange={(e) => onChange({ ...layers, cityAqi: e.target.checked })}
          />
          City air quality (annual)
        </label>
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

      {layers.cityAqi && (
        <div>
          <p className="font-semibold">Indian NAQI (annual)</p>
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
