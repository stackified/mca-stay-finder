import { Slider } from '@/components/ui/slider'
import { inrK } from '@/lib/format'
import {
  ALL_FURNISHED,
  ALL_GENDER,
  ALL_SHARING,
  ALL_SOURCES,
  ALL_STATUS,
  ALL_STAY_TYPES,
  DEFAULT_STAY_TYPES,
  STAY_TYPE_COLOR,
  STAY_TYPE_LABEL,
  STAY_TYPE_SYMBOL,
} from '@/lib/stays'
import { useAppStore } from '@/store/useAppStore'
import { CheckboxGroup, FilterRow, MaxSlider, PendingRow, RangeSlider, ToggleRow } from './controls'

import { VISIT_STATUS_LABEL } from '@/types/userData'
import { AMENITY_KINDS, AMENITY_LABEL } from '@/lib/amenities'

const OSM_HINT = 'OSM places have no data for this. Only your own listings can match.'

/** SPEC §6.2 C — stay filters. */
export function StayFilters() {
  const f = useAppStore((s) => s.filters)
  const set = useAppStore((s) => s.setFilters)
  const selected = useAppStore((s) => s.selectedCollegeId)
  const hasAmenities = useAppStore((s) => !!s.data?.amenities)

  return (
    <div className="divide-y">
      <CheckboxGroup
        label="Stay type"
        allValues={ALL_STAY_TYPES}
        defaultValues={DEFAULT_STAY_TYPES}
        value={f.stayTypes}
        onChange={(stayTypes) => set({ stayTypes })}
        columns={1}
        options={ALL_STAY_TYPES.map((t) => ({
          value: t,
          label: (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: STAY_TYPE_COLOR[t] }}
              >
                {STAY_TYPE_SYMBOL[t]}
              </span>
              {STAY_TYPE_LABEL[t]}
            </span>
          ),
        }))}
      />
      <FilterRow
        label="Max distance from campus"
        value={`${f.stayMaxDistanceKm} km`}
        hint={
          selected
            ? 'Drawn as a ring around the selected campus.'
            : 'Select a college to draw the ring; until then, any visible campus counts.'
        }
      >
        <Slider
          min={0.5}
          max={25}
          step={0.5}
          value={[f.stayMaxDistanceKm]}
          onValueChange={([v]) => v !== undefined && set({ stayMaxDistanceKm: v })}
          thumbLabels={['Max distance from campus, km']}
        />
      </FilterRow>
      <MaxSlider
        label="Max travel time to campus"
        value={f.stayTravelMaxMin}
        onChange={(stayTravelMaxMin) => set({ stayTravelMaxMin })}
        min={5}
        max={90}
        step={5}
        format={(v) => `${v} min`}
        hint="Estimate: straight line × 1.3 at 20 km/h (auto/bus). No routing API."
      />
      <RangeSlider
        label="All-in monthly budget"
        low={f.stayBudgetMin}
        high={f.stayBudgetMax}
        onChange={(stayBudgetMin, stayBudgetMax) => set({ stayBudgetMin, stayBudgetMax })}
        min={4000}
        max={50000}
        step={500}
        format={(v) => `₹${inrK(v)}`}
        hint="Matches if the stay's estimated range overlaps the budget."
      />
      <RangeSlider
        label="Rent only"
        low={f.stayRentMin}
        high={f.stayRentMax}
        onChange={(stayRentMin, stayRentMax) => set({ stayRentMin, stayRentMax })}
        min={2000}
        max={40000}
        step={500}
        format={(v) => `₹${inrK(v)}`}
        hint={OSM_HINT}
      />
      <CheckboxGroup
        label="Sharing (PG / hostel only)"
        allValues={ALL_SHARING}
        value={f.staySharing}
        onChange={(staySharing) => set({ staySharing })}
        columns={3}
        options={ALL_SHARING.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))}
      />
      <ToggleRow
        label="Food included"
        checked={f.stayFoodOnly}
        onChange={(stayFoodOnly) => set({ stayFoodOnly })}
        hint={f.stayFoodOnly ? OSM_HINT : undefined}
      />
      <ToggleRow
        label="AC"
        checked={f.stayAcOnly}
        onChange={(stayAcOnly) => set({ stayAcOnly })}
        hint={f.stayAcOnly ? OSM_HINT : undefined}
      />
      <CheckboxGroup
        label="Furnished"
        allValues={ALL_FURNISHED}
        value={f.stayFurnished}
        onChange={(stayFurnished) => set({ stayFurnished })}
        columns={3}
        options={[
          { value: 'none', label: 'Unfurnished' },
          { value: 'semi', label: 'Semi' },
          { value: 'full', label: 'Fully' },
        ]}
      />
      <CheckboxGroup
        label="Gender"
        allValues={ALL_GENDER}
        value={f.stayGender}
        onChange={(stayGender) => set({ stayGender })}
        options={[
          { value: 'boys', label: 'Boys' },
          { value: 'girls', label: 'Girls' },
          { value: 'coliving', label: 'Co-living' },
          { value: 'any', label: 'Any / not stated' },
        ]}
      />
      {hasAmenities ? (
        <>
          <CheckboxGroup
            label={`Amenities within ${f.stayAmenityRadiusM} m`}
            allValues={AMENITY_KINDS}
            defaultValues={[]}
            value={f.stayAmenities}
            onChange={(stayAmenities) => set({ stayAmenities })}
            options={AMENITY_KINDS.map((k) => ({ value: k, label: AMENITY_LABEL[k] }))}
          />
          {f.stayAmenities.length > 0 && (
            <FilterRow label="Amenity distance" value={`${f.stayAmenityRadiusM} m`}>
              <Slider
                min={100}
                max={2000}
                step={100}
                value={[f.stayAmenityRadiusM]}
                onValueChange={([v]) => v !== undefined && set({ stayAmenityRadiusM: v })}
                thumbLabels={['Amenity distance, metres']}
              />
              <p className="text-[11px] text-muted-foreground">
                Straight line from the stay, OSM data within 5 km of each campus. Small towns may
                miss shops.
              </p>
            </FilterRow>
          )}
        </>
      ) : (
        <PendingRow
          label="Amenities within X m"
          reason="No amenity data loaded (run npm run data:amenities)."
        />
      )}
      <CheckboxGroup
        label="Source"
        allValues={ALL_SOURCES}
        value={f.staySources}
        onChange={(staySources) => set({ staySources })}
        options={[
          { value: 'osm', label: 'OSM-mapped' },
          { value: 'mine', label: 'My listings' },
        ]}
      />
      <CheckboxGroup
        label="Status"
        allValues={ALL_STATUS}
        value={f.stayStatus}
        onChange={(stayStatus) => set({ stayStatus })}
        options={ALL_STATUS.map((s) => ({ value: s, label: VISIT_STATUS_LABEL[s] }))}
      />
    </div>
  )
}
