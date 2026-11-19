/**
 * Domain types and zod schemas (SPEC §8).
 * Types are inferred from the schemas, so the JSON files and the code cannot drift apart.
 * This file must import only `zod`: the Node data scripts load it directly.
 */
import { z } from 'zod'

// ---------- Shared ----------

export const ConfidenceSchema = z.enum(['official', 'aggregator', 'estimate', 'none'])
export type Confidence = z.infer<typeof ConfidenceSchema>

/** A value plus where it came from. `value: null` means "no data". */
export const sourced = <T extends z.ZodType>(value: T) =>
  z
    .object({
      value: value.nullable(),
      source: z.string().optional(),
      asOf: z.string().optional(),
      confidence: ConfidenceSchema,
      note: z.string().optional(),
    })
    // Cast: zod cannot see `value` through the generic parameter.
    .refine((s) => (s as unknown as { value: unknown }).value !== null || s.confidence === 'none', {
      message: 'A null value must have confidence "none"',
    })
export type Sourced<T> = {
  value: T | null
  source?: string
  asOf?: string
  confidence: Confidence
  note?: string
}

/** INR per month unless noted. */
export const RangeSchema = z
  .object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
  .refine((r) => r.min <= r.max, { message: 'min must be <= max' })
export type Range = z.infer<typeof RangeSchema>

const LatSchema = z.number().min(-90).max(90)
const LngSchema = z.number().min(-180).max(180)
const IdSchema = z.string().regex(/^[a-z0-9-]+$/, 'ids are lowercase kebab-case')

/** Wrapper for every JSON file in public/data. */
export const fileSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    meta: z.object({
      generatedAt: z.string(),
      generator: z.string(),
      sources: z.array(z.string()),
      notes: z.array(z.string()).optional(),
    }),
    data: z.array(item),
  })

// ---------- City ----------

/** `West` is not in SPEC §8; it is needed for the excluded Gujarat cities and Diu. */
export const RegionSchema = z.enum(['North', 'Central', 'East', 'NorthEast', 'South', 'West'])
export type Region = z.infer<typeof RegionSchema>

export const CityCostsSchema = z.object({
  pgSingleAllIn: RangeSchema,
  pgDoubleAllIn: RangeSchema,
  flat1bhkAllIn: RangeSchema,
  flat2bhkAllIn: RangeSchema,
  bungalowAllIn: RangeSchema,
  rent: z.object({ bhk1: RangeSchema, bhk2: RangeSchema, house3bhk: RangeSchema }),
  pgRentWithFood: z.object({ single: RangeSchema, double: RangeSchema, triple: RangeSchema }),
  /** PG extras on top of rent: AC power + laundry, transport, misc (SPEC §11.5). */
  pgExtras: z.object({ acLaundry: RangeSchema, transport: RangeSchema, misc: RangeSchema }),
  running: z.object({
    electricity: RangeSchema,
    waterMaint: RangeSchema,
    wifi: RangeSchema,
    food: RangeSchema,
    maidCook: RangeSchema,
    transport: RangeSchema,
    misc: RangeSchema,
  }),
  runningTotal: RangeSchema,
  depositMonths: z.string(),
  pgDepositMonths: z.string(),
  brokerage: z.string(),
  confidence: ConfidenceSchema,
  source: z.string(),
  note: z.string().optional(),
})
export type CityCosts = z.infer<typeof CityCostsSchema>

export const CitySchema = z.object({
  id: IdSchema,
  name: z.string(),
  state: z.string(),
  region: RegionSchema,
  lat: LatSchema,
  lng: LngSchema,
  excluded: z.boolean(),
  annualAQI: sourced(z.number().nonnegative()),
  pm25Annual: sourced(z.number().nonnegative()).optional(),
  poorDaysPerYear: sourced(z.number().int().nonnegative()).optional(),
  worstMonth: z.string().optional(),
  /** 0–10, manual seed. `null` = no data (for example excluded cities). */
  livingScore: z.number().min(0).max(10).nullable(),
  /** `null` = no cost data for this city. */
  costs: CityCostsSchema.nullable(),
  /** Straight-line km from Surat city centre (city level only). */
  distanceFromHomeKm: z.number().nonnegative().optional(),
  summerMaxTempC: z.number().optional(),
  pros: z.string().optional(),
  watchOuts: z.string().optional(),
})
export type City = z.infer<typeof CitySchema>

// ---------- College ----------

export const CollegeTypeSchema = z.enum(['NIT', 'VIT', 'IIIT'])
export type CollegeType = z.infer<typeof CollegeTypeSchema>

export const SubScoresSchema = z.object({
  placement: z.number().min(0).max(10),
  air: z.number().min(0).max(10),
  cost: z.number().min(0).max(10),
  living: z.number().min(0).max(10),
})
export type SubScores = z.infer<typeof SubScoresSchema>

export const CollegeSchema = z.object({
  id: IdSchema,
  name: z.string(),
  type: CollegeTypeSchema,
  cityId: IdSchema,
  lat: LatSchema,
  lng: LngSchema,
  coordsNote: z.string().optional(),
  entrance: z.enum(['NIMCET', 'VITMEE']),
  seats: sourced(z.number().int().nonnegative()),
  selfFinancingSeats: sourced(z.number().int().nonnegative()).optional(),
  durationYears: sourced(z.union([z.literal(2), z.literal(3)])),
  exitOptionNote: z.string().optional(),
  avgPackageLPA: sourced(z.number().nonnegative()),
  medianPackageLPA: sourced(z.number().nonnegative()).optional(),
  highestPackageLPA: sourced(z.number().nonnegative()).optional(),
  placementRatePct: sourced(z.number().min(0).max(100)).optional(),
  recruitersNote: z.string().optional(),
  totalFeesINR: sourced(z.number().nonnegative()).optional(),
  campusHostel: z.boolean(),
  /** 0–10 seeds (SPEC §11.1). `null` = not enough data to score. */
  defaultScores: SubScoresSchema.nullable(),
  /** Final score and verdict as written in SPEC §11.1, for reference only. */
  seedFinal: z.number().min(0).max(10).nullable(),
  verdict: z.string(),
  notes: z.string().optional(),
})
export type College = z.infer<typeof CollegeSchema>

// ---------- Locality ----------

export const LocalitySchema = z.object({
  id: IdSchema,
  collegeId: IdSchema,
  name: z.string(),
  lat: LatSchema,
  lng: LngSchema,
  distanceKm: RangeSchema,
  vibe: z.string(),
  pgDoubleAllIn: RangeSchema,
  flat1bhkAllIn: RangeSchema,
  bungalowAllIn: RangeSchema,
  fit: z.enum(['best', 'budget', 'comfort', 'ok', 'too-far']),
})
export type Locality = z.infer<typeof LocalitySchema>

// ---------- Stay (data arrives in Phase 4) ----------

export const StayTypeSchema = z.enum([
  'pg',
  'hostel',
  'guest_house',
  'apartment',
  'bungalow',
  'campus_hostel',
  'unknown',
])
export type StayType = z.infer<typeof StayTypeSchema>

export const StaySchema = z.object({
  id: z.string(),
  source: z.enum(['osm', 'mine']),
  osmId: z.string().optional(),
  name: z.string(),
  type: StayTypeSchema,
  lat: LatSchema,
  lng: LngSchema,
  nearestCollegeId: IdSchema,
  distanceKm: z.number().nonnegative(),
  rent: z.number().nonnegative().optional(),
  allInEstimate: RangeSchema.optional(),
  sharing: z.enum(['single', 'double', 'triple']).optional(),
  food: z.boolean().optional(),
  ac: z.boolean().optional(),
  furnished: z.enum(['none', 'semi', 'full']).optional(),
  gender: z.enum(['boys', 'girls', 'coliving', 'any']).optional(),
  url: z.string().optional(),
  phone: z.string().optional(),
  photoUrl: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
})
export type Stay = z.infer<typeof StaySchema>

// ---------- Files ----------

export const CitiesFileSchema = fileSchema(CitySchema)
export const CollegesFileSchema = fileSchema(CollegeSchema)
export const LocalitiesFileSchema = fileSchema(LocalitySchema)
export type CitiesFile = z.infer<typeof CitiesFileSchema>
export type CollegesFile = z.infer<typeof CollegesFileSchema>
export type LocalitiesFile = z.infer<typeof LocalitiesFileSchema>
