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
  onSelect,
}: {
  model: CollegeMarkerModel
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { college, score, band, sizePx, isBackup } = model
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
        aria-label={`${college.name}, score ${formatScore(score)}, ${college.verdict}`}
        aria-pressed={selected}
        title={`${college.name} — ${formatScore(score)} (${college.verdict})`}
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-md transition-transform',
          'hover:scale-110 focus-visible:scale-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
          isBackup ? 'border-dashed border-gray-900' : 'border-white',
          selected && 'scale-110 outline-3 outline-offset-2 outline-blue-600',
        )}
        style={{
          width: sizePx,
          height: sizePx,
          backgroundColor: style.color,
          color: style.text,
        }}
      >
        {formatScore(score)}
      </button>
    </Marker>
  )
}
