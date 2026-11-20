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
import { applyStayFilters } from '@/lib/stays'
import { decodeUrlState, encodeUrlState } from '@/lib/urlState'

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
}

const fromUrl = () => decodeUrlState(typeof window === 'undefined' ? '' : window.location.search)
const defaults = () => decodeUrlState('')

export type ResultsTab = 'ranked' | 'stays' | 'charts' | 'compare'

export const useAppStore = create<AppState>()((set) => ({
  data: null,
  selectedStayId: null,
  resultsTab: 'ranked',
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

  const colleges = useMemo(() => {
    if (!data) return null
    const cities = data.cities.data
    const outcomes = applyFilters(data.colleges.data, cities, filters)
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
      impact: matchCount === 0 ? filterImpact(outcomes, filters) : [],
    }
  }, [data, filters, weights, scoreMode])

  // Stays: within the ring of the selected campus, or of any visible campus if none is selected.
  return useMemo(() => {
    if (!data || !colleges) return null
    const live = colleges.rows.filter((r) => !r.excluded)
    const selectedRow = colleges.rows.find((r) => r.college.id === selectedCollegeId) ?? null
    const selected = selectedRow
      ? { id: selectedRow.college.id, lat: selectedRow.college.lat, lng: selectedRow.college.lng }
      : null
    const stays = applyStayFilters(data.stays?.data ?? [], filters, {
      selected,
      campuses: live.map((r) => ({ id: r.college.id, lat: r.college.lat, lng: r.college.lng })),
    })
    return { ...colleges, selected: selectedRow, stays }
  }, [data, colleges, filters, selectedCollegeId])
}

export type Results = NonNullable<ReturnType<typeof useResults>>
