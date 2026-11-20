/**
 * One Zustand store for data, filters, weights, sort and selection (SPEC §5).
 * Initial state comes from the URL; every change is written back with replaceState,
 * so any view can be bookmarked or shared.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import type { SeedData } from '@/lib/data'
import { applyFilters, filterImpact, type FilterState } from '@/lib/filters'
import { PRESETS, type SortState } from '@/lib/presets'
import {
  rankColleges,
  rebalanceWeights,
  type ScoreMode,
  type WeightKey,
  type Weights,
} from '@/lib/scoring'
import { AmenityIndex, rowToAmenity } from '@/lib/amenities'
import type { LiveResult } from '@/lib/liveAirCache'
import { applyStayFilters } from '@/lib/stays'
import { MAX_COMPARE, decodeUrlState, encodeUrlState } from '@/lib/urlState'
import type { Stay } from '@/types/domain'
import { entityKey } from '@/types/userData'
import { useListings, useStatusMap } from './useOwnerData'

export type AppState = {
  data: SeedData | null
  filters: FilterState
  weights: Weights
  scoreMode: ScoreMode
  sorting: SortState
  selectedCollegeId: string | null
  /** Not in the URL: transient UI state. */
  selectedStayId: string | null
  resultsTab: ResultsTab
  /** Live AQI from Open-Meteo with cache/snapshot fallback (Phase 6). */
  live: { loading: boolean; result: LiveResult | null }
  /** Map AQI circles: CPCB annual or Open-Meteo live (SPEC §6.3 "toggle annual vs live"). */
  aqiMode: 'annual' | 'live'
  setLive: (live: AppState['live']) => void
  setAqiMode: (mode: AppState['aqiMode']) => void

  setData: (data: SeedData) => void
  selectStay: (id: string | null) => void
  setResultsTab: (tab: ResultsTab) => void
  setFilters: (patch: Partial<FilterState>) => void
  resetFilters: (keys?: (keyof FilterState)[]) => void
  setWeight: (key: WeightKey, value: number) => void
  resetWeights: () => void
  setScoreMode: (mode: ScoreMode) => void
  setSorting: (sorting: SortState) => void
  selectCollege: (id: string | null) => void
  applyPreset: (id: string) => void
  /** Applies a saved custom preset (stored as a URL query string). */
  applyQuery: (query: string) => void
  compareIds: string[]
  /** Adds or removes a college from Compare (max 3; the oldest drops out). */
  toggleCompare: (id: string) => void

  /** "Add my listing" form (SPEC §6.5). The draft survives while the owner picks a point on the map. */
  listingForm: { open: boolean; picking: boolean; draft: ListingDraft }
  openListingForm: (opts?: { edit?: Stay; collegeId?: string }) => void
  updateListingDraft: (patch: Partial<ListingDraft>) => void
  closeListingForm: () => void
  startPickLocation: () => void
  /** `null` cancels picking and reopens the form unchanged. */
  pickLocation: (point: { lat: number; lng: number } | null) => void
}

/** Form fields as typed (numbers as text so a field can be empty). */
export type ListingDraft = {
  editId?: string
  createdAt?: string
  name: string
  type: Stay['type']
  collegeId: string
  lat?: number
  lng?: number
  locality: string
  rent: string
  deposit: string
  sharing: '' | NonNullable<Stay['sharing']>
  food: '' | 'yes' | 'no'
  ac: '' | 'yes' | 'no'
  furnished: '' | NonNullable<Stay['furnished']>
  gender: '' | NonNullable<Stay['gender']>
  phone: string
  url: string
  photoUrl: string
}

const yesNo = (v: boolean | undefined): '' | 'yes' | 'no' =>
  v === undefined ? '' : v ? 'yes' : 'no'

export function draftFromStay(s: Stay): ListingDraft {
  return {
    editId: s.id,
    createdAt: s.createdAt,
    name: s.name,
    type: s.type,
    collegeId: s.nearestCollegeId,
    lat: s.lat,
    lng: s.lng,
    locality: s.locality ?? '',
    rent: s.rent?.toString() ?? '',
    deposit: s.deposit?.toString() ?? '',
    sharing: s.sharing ?? '',
    food: yesNo(s.food),
    ac: yesNo(s.ac),
    furnished: s.furnished ?? '',
    gender: s.gender ?? '',
    phone: s.phone ?? '',
    url: s.url ?? '',
    photoUrl: s.photoUrl ?? '',
  }
}

export const emptyDraft = (collegeId = ''): ListingDraft => ({
  name: '',
  type: 'pg',
  collegeId,
  locality: '',
  rent: '',
  deposit: '',
  sharing: '',
  food: '',
  ac: '',
  furnished: '',
  gender: '',
  phone: '',
  url: '',
  photoUrl: '',
})

const fromUrl = () => decodeUrlState(typeof window === 'undefined' ? '' : window.location.search)
const defaults = () => decodeUrlState('')

export type ResultsTab = 'ranked' | 'stays' | 'charts' | 'compare'

export const useAppStore = create<AppState>()((set) => ({
  data: null,
  selectedStayId: null,
  resultsTab: 'ranked',
  live: { loading: false, result: null },
  aqiMode: 'annual',
  setLive: (live) => set({ live }),
  setAqiMode: (aqiMode) => set({ aqiMode }),
  ...fromUrl(),

  setData: (data) => set({ data }),
  selectStay: (selectedStayId) => set({ selectedStayId }),
  setResultsTab: (resultsTab) => set({ resultsTab }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: (keys) =>
    set((s) => {
      const d = defaults().filters
      if (!keys) return { filters: d }
      const next = { ...s.filters }
      for (const k of keys) (next as Record<string, unknown>)[k] = d[k]
      return { filters: next }
    }),
  setWeight: (key, value) => set((s) => ({ weights: rebalanceWeights(s.weights, key, value) })),
  resetWeights: () => set({ weights: defaults().weights }),
  setScoreMode: (scoreMode) => set({ scoreMode }),
  setSorting: (sorting) => set({ sorting }),
  // A new campus clears the stay popup.
  selectCollege: (selectedCollegeId) => set({ selectedCollegeId, selectedStayId: null }),
  applyPreset: (id) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (preset) set(preset.build())
  },
  applyQuery: (query) => set(decodeUrlState(query)),
  toggleCompare: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id)
        ? s.compareIds.filter((x) => x !== id)
        : [...s.compareIds, id].slice(-MAX_COMPARE),
    })),

  listingForm: { open: false, picking: false, draft: emptyDraft() },
  openListingForm: (opts) =>
    set((s) => ({
      listingForm: {
        open: true,
        picking: false,
        draft: opts?.edit
          ? draftFromStay(opts.edit)
          : emptyDraft(opts?.collegeId ?? s.selectedCollegeId ?? ''),
      },
    })),
  updateListingDraft: (patch) =>
    set((s) => ({
      listingForm: { ...s.listingForm, draft: { ...s.listingForm.draft, ...patch } },
    })),
  closeListingForm: () =>
    set((s) => ({ listingForm: { ...s.listingForm, open: false, picking: false } })),
  startPickLocation: () =>
    set((s) => ({ listingForm: { ...s.listingForm, open: false, picking: true } })),
  pickLocation: (point) =>
    set((s) => ({
      listingForm: {
        open: true,
        picking: false,
        draft: point
          ? { ...s.listingForm.draft, lat: point.lat, lng: point.lng }
          : s.listingForm.draft,
      },
    })),
}))

// URL sync (skipped in tests without a window).
if (typeof window !== 'undefined') {
  useAppStore.subscribe((s) => {
    const q = encodeUrlState(s)
    const next = `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, '', next)
    }
  })
}

/** Filtered, scored and ranked results. Recomputed only when its inputs change. */
export function useResults() {
  const data = useAppStore((s) => s.data)
  const filters = useAppStore((s) => s.filters)
  const weights = useAppStore((s) => s.weights)
  const scoreMode = useAppStore((s) => s.scoreMode)
  const selectedCollegeId = useAppStore((s) => s.selectedCollegeId)
  // Own listings and visit status live in IndexedDB.
  const listings = useListings()
  const statusMap = useStatusMap()
  const liveData = useAppStore((s) => s.live.result?.data ?? null)
  // One index over all campuses' amenities, built once per data load.
  const amenityIndex = useMemo(
    () =>
      data?.amenities
        ? new AmenityIndex(Object.values(data.amenities.byCampus).flat().map(rowToAmenity))
        : null,
    [data],
  )

  const colleges = useMemo(() => {
    if (!data) return null
    const cities = data.cities.data
    // Without live data the live filter is paused (not "match nothing"): the owner could not
    // see or reset a disabled filter that hides every college.
    const effective = liveData ? filters : { ...filters, liveAqiMax: null }
    const outcomes = applyFilters(data.colleges.data, cities, effective, {
      liveNaqi: (cityId) => liveData?.byCity[cityId]?.naqi,
    })
    const rows = rankColleges(outcomes, weights, scoreMode)
    const cityIds = new Set(rows.map((r) => r.college.cityId))
    const visibleCities = cities.filter((c) => cityIds.has(c.id))
    const rankedCount = rows.filter((r) => r.rank !== null).length
    const matchCount = rows.filter((r) => !r.excluded).length
    return {
      rows,
      visibleCities,
      rankedCount,
      matchCount,
      impact: matchCount === 0 ? filterImpact(outcomes, effective) : [],
    }
  }, [data, filters, weights, scoreMode, liveData])

  // Stays: within the ring of the selected campus, or of any visible campus if none is selected.
  return useMemo(() => {
    if (!data || !colleges) return null
    const live = colleges.rows.filter((r) => !r.excluded)
    const selectedRow = colleges.rows.find((r) => r.college.id === selectedCollegeId) ?? null
    const selected = selectedRow
      ? { id: selectedRow.college.id, lat: selectedRow.college.lat, lng: selectedRow.college.lng }
      : null
    const stays = applyStayFilters([...listings, ...(data.stays?.data ?? [])], filters, {
      selected,
      campuses: live.map((r) => ({ id: r.college.id, lat: r.college.lat, lng: r.college.lng })),
      statusOf: (id) => statusMap.get(entityKey('stay', id)) ?? 'not_visited',
      amenities: amenityIndex,
    })
    return { ...colleges, selected: selectedRow, stays, listingCount: listings.length }
  }, [data, colleges, filters, selectedCollegeId, listings, statusMap, amenityIndex])
}

export type Results = NonNullable<ReturnType<typeof useResults>>
