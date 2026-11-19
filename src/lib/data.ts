/**
 * Loads and validates the static JSON in public/data.
 * Relative URLs work with `base: './'` (dev server, preview and GitHub Pages).
 */
import { useEffect, useState } from 'react'
import {
  CitiesFileSchema,
  CollegesFileSchema,
  LocalitiesFileSchema,
  type CitiesFile,
  type CollegesFile,
  type LocalitiesFile,
} from '@/types/domain'

export type SeedData = {
  cities: CitiesFile
  colleges: CollegesFile
  localities: LocalitiesFile
}

const dataUrl = (name: string) => `${import.meta.env.BASE_URL}data/${name}`

async function getJson(name: string, fetchFn: typeof fetch): Promise<unknown> {
  const res = await fetchFn(dataUrl(name))
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return res.json()
}

export async function loadSeedData(fetchFn: typeof fetch = fetch): Promise<SeedData> {
  const [cities, colleges, localities] = await Promise.all([
    getJson('cities.json', fetchFn),
    getJson('colleges.json', fetchFn),
    getJson('localities.json', fetchFn),
  ])
  return {
    cities: CitiesFileSchema.parse(cities),
    colleges: CollegesFileSchema.parse(colleges),
    localities: LocalitiesFileSchema.parse(localities),
  }
}

export type SeedState =
  { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: SeedData }

export function useSeedData(): SeedState {
  const [state, setState] = useState<SeedState>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    loadSeedData()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((err: unknown) => {
        if (alive)
          setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      alive = false
    }
  }, [])
  return state
}
