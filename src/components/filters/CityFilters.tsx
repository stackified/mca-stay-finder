import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ALL_REGIONS, cityCostIndex } from '@/lib/filters'
import { inrK } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { City } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'
import { CheckboxGroup, MaxSlider, MinSlider, PendingRow, ToggleRow } from './controls'

const AQI_CHIPS = [
  { label: 'Good', max: 50 },
  { label: 'Satisfactory', max: 100 },
  { label: 'Moderate', max: 200 },
] as const

// Stable empty array, so memo dependencies do not change on every render.
const NO_CITIES: City[] = []

const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => x != null)

/** SPEC §6.2 B — city filters. */
export function CityFilters() {
  const cities = useAppStore((s) => s.data?.cities.data) ?? NO_CITIES
  const f = useAppStore((s) => s.filters)
  const set = useAppStore((s) => s.setFilters)
  const liveSource = useAppStore((s) => s.live.result?.source)
  const liveLoading = useAppStore((s) => s.live.loading)
  const liveAvailable = !!liveSource && liveSource !== 'none'

  const b = useMemo(() => {
    const costs = nums(cities.map(cityCostIndex))
    return {
      poor: Math.ceil(Math.max(0, ...nums(cities.map((c) => c.poorDaysPerYear?.value))) / 10) * 10,
      costMin: Math.floor(Math.min(...costs) / 500) * 500,
      costMax: Math.ceil(Math.max(...costs) / 500) * 500,
      home: Math.ceil(Math.max(0, ...nums(cities.map((c) => c.distanceFromHomeKm))) / 100) * 100,
    }
  }, [cities])

  return (
    <div className="divide-y">
      <MaxSlider
        label="Annual AQI (Indian NAQI)"
        value={f.annualAqiMax}
        onChange={(annualAqiMax) => set({ annualAqiMax })}
        min={0}
        max={250}
        step={5}
        hint="Cities with no AQI data are hidden while this is set."
      >
        <div className="flex flex-wrap gap-1" role="group" aria-label="AQI quick limits">
          {AQI_CHIPS.map((c) => (
            <Button
              key={c.max}
              size="xs"
              variant={f.annualAqiMax === c.max ? 'default' : 'outline'}
              aria-pressed={f.annualAqiMax === c.max}
              onClick={() => set({ annualAqiMax: f.annualAqiMax === c.max ? null : c.max })}
              className={cn('h-6 px-2 text-[11px]')}
            >
              {c.label} ≤{c.max}
            </Button>
          ))}
        </div>
      </MaxSlider>
      <MaxSlider
        label={'"Poor or worse" days / year'}
        value={f.poorDaysMax}
        onChange={(poorDaysMax) => set({ poorDaysMax })}
        min={0}
        max={b.poor}
        step={5}
        hint="Only 8 cities have this figure; cities without it stay visible."
      />
      {liveAvailable ? (
        <MaxSlider
          label="Live AQI (last 24 h)"
          value={f.liveAqiMax}
          onChange={(liveAqiMax) => set({ liveAqiMax })}
          min={0}
          max={400}
          step={10}
          hint={
            <>
              Open-Meteo CAMS model, 24-h mean, not a CPCB station reading
              {liveSource === 'stale-cache' || liveSource === 'snapshot' ? ' — cached data' : ''}.
            </>
          }
        />
      ) : (
        <PendingRow
          label="Live AQI (last 24 h)"
          reason={
            liveLoading
              ? 'Loading live data…'
              : f.liveAqiMax !== null
                ? `Paused (≤ ${f.liveAqiMax} is kept): live data unavailable right now.`
                : 'Live data unavailable right now (offline or API down).'
          }
        />
      )}
      <PendingRow label="Worst-month AQI" reason="No monthly AQI data in the seed yet." />
      <MaxSlider
        label="Cost of living (PG double all-in)"
        value={f.costMax}
        onChange={(costMax) => set({ costMax })}
        min={b.costMin}
        max={b.costMax}
        step={250}
        format={(v) => `₹${inrK(v)}`}
        hint="Midpoint of the city's PG-double all-in range, ₹/month (estimate)."
      />
      <MinSlider
        label="Standard of living"
        value={f.livingMin}
        onChange={(livingMin) => set({ livingMin })}
        min={0}
        max={10}
        step={0.5}
        format={(v) => `${v}/10`}
      />
      <PendingRow label="Summer max temperature" reason="Only Warangal has a figure; filter off." />
      <CheckboxGroup
        label="Region"
        allValues={ALL_REGIONS}
        value={f.regions}
        onChange={(regions) => set({ regions })}
        options={ALL_REGIONS.map((r) => ({
          value: r,
          label: r === 'NorthEast' ? 'North-East' : r,
        }))}
      />
      <MaxSlider
        label="Distance from Surat"
        value={f.homeDistanceMaxKm}
        onChange={(homeDistanceMaxKm) => set({ homeDistanceMaxKm })}
        min={0}
        max={b.home}
        step={50}
        format={(v) => `${v} km`}
        hint="Straight line from Surat city centre. Train hours: no free data source yet."
      />
      <ToggleRow
        label="Show excluded cities"
        checked={f.showExcluded}
        onChange={(showExcluded) => set({ showExcluded })}
        hint="Ahmedabad / Gandhinagar / Vadodara / Mumbai / Pune area. Shown greyed, never ranked."
      />
    </div>
  )
}
