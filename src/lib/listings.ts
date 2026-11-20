/**
 * "Add my listing" (SPEC §6.5): form input → Stay with source "mine". Pure, unit-tested.
 */
import type { City, College, Range, Stay } from '@/types/domain'
import { haversineKm } from './geo'
import { addRanges } from './rangeMath'

export type ListingInput = {
  name: string
  type: Stay['type']
  collegeId: string
  lat: number
  lng: number
  locality?: string
  rent?: number
  deposit?: number
  sharing?: Stay['sharing']
  food?: boolean
  ac?: boolean
  furnished?: Stay['furnished']
  gender?: Stay['gender']
  phone?: string
  url?: string
  photoUrl?: string
}

/**
 * All-in estimate from the owner's rent plus the city's monthly extras (SPEC §11.4/11.5):
 *   PG / hostel / guest house: rent + AC power & laundry + transport + misc (+ food if not included)
 *   flat:                       rent + running total (electricity, water, Wi-Fi, food, maid, transport, misc)
 *   bungalow:                   rent + running total + ₹2k–4k (SPEC §11.4 formula)
 */
export function listingAllIn(
  rent: number,
  type: Stay['type'],
  food: boolean | undefined,
  city: City | undefined,
): Range {
  const base = { min: rent, max: rent }
  const c = city?.costs
  if (!c) return base
  const pgExtras = addRanges(c.pgExtras.acLaundry, c.pgExtras.transport, c.pgExtras.misc)
  switch (type) {
    case 'pg':
    case 'hostel':
    case 'guest_house':
      return food === false ? addRanges(base, pgExtras, c.running.food) : addRanges(base, pgExtras)
    case 'apartment':
      return addRanges(base, c.runningTotal)
    case 'bungalow':
      return addRanges(base, c.runningTotal, { min: 2000, max: 4000 })
    default:
      return base
  }
}

const clean = (s: string | undefined) => (s && s.trim() !== '' ? s.trim() : undefined)

/** Only http(s) links are kept (no javascript: or data: URLs from a pasted form). */
export const safeUrl = (s: string | undefined) => {
  const v = clean(s)
  if (!v) return undefined
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}

export function buildListing(
  input: ListingInput,
  college: College,
  city: City | undefined,
  opts: { id?: string; createdAt?: string } = {},
): Stay {
  const name = input.name.trim()
  if (!name) throw new Error('A title is required')
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng))
    throw new Error('A location is required')
  const distanceKm = Number(haversineKm(college, input).toFixed(3))
  const now = new Date().toISOString()
  const listing: Stay = {
    id: opts.id ?? `mine-${crypto.randomUUID()}`,
    source: 'mine',
    name,
    type: input.type,
    lat: Number(input.lat.toFixed(6)),
    lng: Number(input.lng.toFixed(6)),
    nearestCollegeId: college.id,
    distanceKm,
    createdAt: opts.createdAt ?? now,
    updatedAt: now,
  }
  const set = <K extends keyof Stay>(k: K, v: Stay[K] | undefined) => {
    if (v !== undefined) listing[k] = v
  }
  set('locality', clean(input.locality))
  set('rent', input.rent)
  set('deposit', input.deposit)
  set('sharing', input.sharing)
  set('food', input.food)
  set('ac', input.ac)
  set('furnished', input.furnished)
  set('gender', input.gender)
  set('phone', clean(input.phone))
  set('url', safeUrl(input.url))
  set('photoUrl', safeUrl(input.photoUrl))
  if (input.rent !== undefined)
    set('allInEstimate', listingAllIn(input.rent, input.type, input.food, city))
  return listing
}
