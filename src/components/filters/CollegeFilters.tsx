import { useMemo } from 'react'
import { ALL_CONFIDENCE, ALL_DURATIONS, ALL_TYPES, DEFAULT_FILTERS } from '@/lib/filters'
import type { College } from '@/types/domain'
import { useAppStore } from '@/store/useAppStore'
import { CheckboxGroup, MaxSlider, MinSlider, RangeSlider, ToggleRow } from './controls'
import { InstitutePicker } from './InstitutePicker'

// Stable empty array, so memo dependencies do not change on every render.
const NO_COLLEGES: College[] = []

const maxOf = (xs: (number | null | undefined)[]) =>
  Math.max(0, ...xs.filter((x): x is number => x != null))

/** SPEC §6.2 A — college filters. Slider bounds come from the data. */
export function CollegeFilters() {
  const colleges = useAppStore((s) => s.data?.colleges.data) ?? NO_COLLEGES
  const f = useAppStore((s) => s.filters)
  const set = useAppStore((s) => s.setFilters)

  const b = useMemo(
    () => ({
      avg: Math.ceil(maxOf(colleges.map((c) => c.avgPackageLPA.value))),
      high: Math.ceil(maxOf(colleges.map((c) => c.highestPackageLPA?.value)) / 5) * 5,
      seats: Math.ceil(maxOf(colleges.map((c) => c.seats.value)) / 10) * 10,
      fees: Math.ceil(maxOf(colleges.map((c) => c.totalFeesINR?.value)) / 50000) * 50000 || 500000,
    }),
    [colleges],
  )

  return (
    <div className="divide-y">
      <CheckboxGroup
        label="Institute type"
        allValues={ALL_TYPES}
        defaultValues={DEFAULT_FILTERS.types}
        value={f.types}
        onChange={(types) => set({ types })}
        columns={3}
        options={[
          { value: 'NIT', label: 'NIT' },
          { value: 'VIT', label: 'VIT (backup)' },
          { value: 'IIIT', label: 'IIIT' },
        ]}
      />
      <InstitutePicker
        colleges={colleges}
        value={f.instituteIds}
        onChange={(instituteIds) => set({ instituteIds })}
      />
      <RangeSlider
        label="MCA average package"
        low={f.avgPackageMin}
        high={f.avgPackageMax}
        onChange={(avgPackageMin, avgPackageMax) => set({ avgPackageMin, avgPackageMax })}
        min={0}
        max={b.avg}
        step={0.5}
        format={(v) => `${v} LPA`}
        hint="When set, colleges with no package data are hidden."
      />
      <MinSlider
        label="Placement rate"
        value={f.placementRateMin}
        onChange={(placementRateMin) => set({ placementRateMin })}
        min={0}
        max={100}
        step={5}
        format={(v) => `${v}%`}
      />
      <MinSlider
        label="Highest package"
        value={f.highestPackageMin}
        onChange={(highestPackageMin) => set({ highestPackageMin })}
        min={0}
        max={b.high}
        step={1}
        format={(v) => `${v} LPA`}
      />
      <CheckboxGroup
        label="Placement data confidence"
        allValues={ALL_CONFIDENCE}
        value={f.placementConfidence}
        onChange={(placementConfidence) => set({ placementConfidence })}
        options={[
          { value: 'official', label: 'Official' },
          { value: 'aggregator', label: 'Aggregator' },
          { value: 'estimate', label: 'Estimate' },
          { value: 'none', label: 'No data' },
        ]}
      />
      <CheckboxGroup
        label="MCA duration"
        allValues={ALL_DURATIONS}
        value={f.durations}
        onChange={(durations) => set({ durations })}
        columns={3}
        options={[
          { value: '2', label: '2 yr' },
          { value: '3', label: '3 yr' },
          { value: 'unknown', label: 'Unknown' },
        ]}
      />
      <MinSlider
        label="Seats"
        value={f.seatsMin}
        onChange={(seatsMin) => set({ seatsMin })}
        min={0}
        max={b.seats}
        step={5}
      />
      <ToggleRow
        label="Self-financing seats available"
        checked={f.selfFinancingOnly}
        onChange={(selfFinancingOnly) => set({ selfFinancingOnly })}
      />
      <ToggleRow
        label="Campus hostel available (backup)"
        checked={f.campusHostelOnly}
        onChange={(campusHostelOnly) => set({ campusHostelOnly })}
      />
      <MaxSlider
        label="Program fees (total)"
        value={f.feesMax}
        onChange={(feesMax) => set({ feesMax })}
        min={0}
        max={b.fees}
        step={10000}
        format={(v) => `₹${(v / 100000).toFixed(1)} L`}
        hint="Only VIT Vellore has a fee figure yet. Colleges with unknown fees stay visible."
      />
    </div>
  )
}
