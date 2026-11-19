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
import { decodeUrlState, encodeUrlState } from '@/lib/urlState'

export type AppState = {
  data: SeedData | null
  filters: FilterState
  weights: Weights
  scoreMode: ScoreMode
  sorting: SortState
  selectedCollegeId: string | null

  setData: (data: SeedData) => void
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

export const useAppStore = create<AppState>()((set) => ({
  data: null,
  ...fromUrl(),

  setData: (data) => set({ data }),
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
  selectCollege: (selectedCollegeId) => set({ selectedCollegeId }),
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

  return useMemo(() => {
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
}

export type Results = NonNullable<ReturnType<typeof useResults>>
