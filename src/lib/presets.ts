/**
 * One-click presets (SPEC §6.2 E). Each preset starts from the owner defaults.
 * "Custom (saved)" presets come with IndexedDB in Phase 5.
 */
import { DEFAULT_FILTERS, type FilterState } from './filters'
import { DEFAULT_WEIGHTS, type Weights } from './scoring'

export type SortState = { id: string; desc: boolean }[]

export type PresetResult = { filters: FilterState; weights: Weights; sorting: SortState }

export type Preset = { id: string; label: string; description: string; build: () => PresetResult }

const base = (): PresetResult => ({
  filters: structuredClone(DEFAULT_FILTERS) as FilterState,
  weights: { ...DEFAULT_WEIGHTS },
  sorting: [],
})

export const PRESETS: readonly Preset[] = [
  {
    id: 'owner',
    label: 'Owner default',
    description: 'NIT + VIT, excluded cities hidden, weights 40/25/20/15',
    build: base,
  },
  {
    id: 'placement-first',
    label: 'Placement first',
    description: 'NIT only, weights 60/15/15/10',
    build: () => {
      const p = base()
      p.filters.types = ['NIT']
      p.weights = { placement: 60, air: 15, cost: 15, living: 10 }
      return p
    },
  },
  {
    id: 'clean-air',
    label: 'Clean air first',
    description: 'Annual AQI ≤ 100, weights 30/45/15/10',
    build: () => {
      const p = base()
      p.filters.annualAqiMax = 100
      p.weights = { placement: 30, air: 45, cost: 15, living: 10 }
      return p
    },
  },
  {
    id: 'cheapest-good',
    label: 'Cheapest good option',
    description: 'Avg package ≥ 9 LPA, sorted by PG double all-in cost',
    build: () => {
      const p = base()
      p.filters.avgPackageMin = 9
      p.sorting = [{ id: 'pgDouble', desc: false }]
      return p
    },
  },
  {
    id: 'walk',
    label: 'Walk to campus',
    description: 'Stays within 2 km of campus (stays arrive in Phase 4)',
    build: () => {
      const p = base()
      p.filters.stayMaxDistanceKm = 2
      return p
    },
  },
  {
    id: 'vit-backup',
    label: 'Backup (VIT)',
    description: 'VIT campuses only',
    build: () => {
      const p = base()
      p.filters.types = ['VIT']
      return p
    },
  },
]
