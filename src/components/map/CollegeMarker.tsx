import { Marker } from 'react-map-gl/maplibre'
import type { CollegeMarkerModel } from '@/lib/mapData'
import { SCORE_BAND_STYLE, formatScore } from '@/lib/scoring'
import { cn } from '@/lib/utils'

/**
 * College marker (SPEC §6.3): colour = final score, size = seats, dashed outline = VIT backup.
 * A real <button>, so it is keyboard-operable and has an accessible name.
 */
export function CollegeMarker({
  model,
  selected,
  starred = false,
  onSelect,
}: {
  model: CollegeMarkerModel
  selected: boolean
  /** On the owner's shortlist: shows a ★ badge. */
  starred?: boolean
  onSelect: (id: string | null) => void
}) {
  const { college, final: score, band, sizePx, isBackup, excluded } = model
  const style = SCORE_BAND_STYLE[band]
  return (
    <Marker
      longitude={college.lng}
      latitude={college.lat}
      anchor="center"
      style={{ zIndex: selected ? 2 : 1 }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSelect(college.id)
        }}
        aria-label={
          excluded
            ? `${college.name}, excluded city, not ranked`
            : `${college.name}, score ${formatScore(score)}, ${college.verdict}${starred ? ', shortlisted' : ''}`
        }
        aria-pressed={selected}
        title={
          excluded
            ? `${college.name} — excluded city (not ranked)`
            : `${college.name} — ${formatScore(score)} (${college.verdict})`
        }
        className={cn(
          'relative flex cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-md transition-transform',
          'hover:scale-110 focus-visible:scale-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
          isBackup ? 'border-dashed border-gray-900' : 'border-white',
          selected && 'scale-110 outline-3 outline-offset-2 outline-blue-600',
          excluded && 'opacity-45 grayscale',
        )}
        style={{
          width: sizePx,
          height: sizePx,
          backgroundColor: style.color,
          color: style.text,
        }}
      >
        {formatScore(score)}
        {starred && (
          <span
            aria-hidden
            className="absolute -top-2 -right-2 text-sm leading-none text-amber-400 [text-shadow:0_0_2px_#000]"
          >
            ★
          </span>
        )}
      </button>
    </Marker>
  )
}
