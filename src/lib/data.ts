/**
 * Loads and validates the static JSON in public/data.
 * Relative URLs work with `base: './'` (dev server, preview and GitHub Pages).
 */
import { useEffect, useState } from 'react'
import { AmenitiesFileSchema, type AmenitiesFile } from './amenities'
import {
  CitiesFileSchema,
  CollegesFileSchema,
  LocalitiesFileSchema,
  StaysFileSchema,
  type CitiesFile,
  type CollegesFile,
  type LocalitiesFile,
  type StaysFile,
} from '@/types/domain'

export type SeedData = {
  cities: CitiesFile
  colleges: CollegesFile
  localities: LocalitiesFile
  /** `null` when stays.osm.json is missing or invalid; the app works without it. */
  stays: StaysFile | null
  /** `null` when amenities.json is missing or invalid (Phase 6). */
  amenities: AmenitiesFile | null
  /** True when the service worker answered from its cache (server or network unreachable). */
  fromCache: boolean
}

/** Set by getJson when any data file came from the service-worker cache. */
let servedFromCache = false

export const dataUrl = (name: string) => `${import.meta.env.BASE_URL}data/${name}`

async function optionalAmenities(fetchFn: typeof fetch): Promise<AmenitiesFile | null> {
  try {
    return AmenitiesFileSchema.parse(await getJson('amenities.json', fetchFn))
  } catch (err) {
    console.warn('No amenities loaded:', err instanceof Error ? err.message : err)
    return null
  }
}

async function optionalStays(fetchFn: typeof fetch): Promise<StaysFile | null> {
  try {
    return StaysFileSchema.parse(await getJson('stays.osm.json', fetchFn))
  } catch (err) {
    console.warn('No OSM stays loaded:', err instanceof Error ? err.message : err)
    return null
  }
}

async function getJson(name: string, fetchFn: typeof fetch): Promise<unknown> {
  const res = await fetchFn(dataUrl(name))
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  if (res.headers.get('x-sw-cache') === '1') servedFromCache = true
  return res.json()
}

export async function loadSeedData(fetchFn: typeof fetch = fetch): Promise<SeedData> {
  servedFromCache = false
  const [cities, colleges, localities, stays, amenities] = await Promise.all([
    getJson('cities.json', fetchFn),
    getJson('colleges.json', fetchFn),
    getJson('localities.json', fetchFn),
    optionalStays(fetchFn),
    optionalAmenities(fetchFn),
  ])
  return {
    cities: CitiesFileSchema.parse(cities),
    colleges: CollegesFileSchema.parse(colleges),
    localities: LocalitiesFileSchema.parse(localities),
    stays,
    amenities,
    fromCache: servedFromCache,
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
