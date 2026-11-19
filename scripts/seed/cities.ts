/**
 * City seed data — SPEC §11.2 (air), §11.3 (rent), §11.4 (running), §11.5 (PG), §11.7 (notes).
 * Money: thousands of INR in `k()`, plain INR in `inr()`. All per month.
 * City coordinates are approximate city centres (used for AQI circles and distance from home).
 */
import type { City, CityCosts, Range, Region, Sourced } from '../../src/types/domain.ts'
import { HOME_CITY, haversineKm } from '../../src/lib/geo.ts'
import { pmToNaqi } from '../../src/lib/naqi.ts'
import { AS_OF, SOURCES, addRanges, inr, k, mid } from './util.ts'

type Running = [
  electricity: Range,
  waterMaint: Range,
  wifi: Range,
  food: Range,
  maidCook: Range,
  transport: Range,
  misc: Range,
]

type Pg = {
  single: Range
  double: Range
  triple: Range
  deposit: string
  acLaundry: Range
  transport: Range
  misc: Range
  totalSingle: Range
  totalDouble: Range
}

type Rent = { bhk1: Range; bhk2: Range; house3bhk: Range; deposit: string; brokerage: string }

// ---------- Cost tables (verbatim from SPEC) ----------

// prettier-ignore
const RENT: Record<string, Rent> = {
  delhi: { bhk1: k(7, 11), bhk2: k(10, 16), house3bhk: k(18, 28), deposit: '2–3 months', brokerage: '~1 month' },
  kurukshetra: { bhk1: k(6, 9), bhk2: k(8, 13), house3bhk: k(14, 22), deposit: '1–2 months', brokerage: 'Rare' },
  prayagraj: { bhk1: k(6, 9), bhk2: k(9, 14), house3bhk: k(15, 25), deposit: '1–2 months', brokerage: 'Rare' },
  bhopal: { bhk1: k(7, 10), bhk2: k(10, 15), house3bhk: k(18, 28), deposit: '1–2 months', brokerage: '~½ month' },
  raipur: { bhk1: k(7, 10), bhk2: k(10, 15), house3bhk: k(16, 25), deposit: '1–2 months', brokerage: 'Rare' },
  patna: { bhk1: k(8, 12), bhk2: k(12, 18), house3bhk: k(20, 30), deposit: '1–2 months', brokerage: '~½–1 month' },
  jamshedpur: { bhk1: k(7, 10), bhk2: k(10, 15), house3bhk: k(16, 25), deposit: '1–2 months', brokerage: 'Rare' },
  agartala: { bhk1: k(6, 9), bhk2: k(9, 14), house3bhk: k(15, 22), deposit: '1–2 months', brokerage: 'Rare' },
  shillong: { bhk1: k(9, 13), bhk2: k(13, 20), house3bhk: k(22, 35), deposit: '1–2 months', brokerage: 'Rare' },
  warangal: { bhk1: k(6, 9), bhk2: k(9, 13), house3bhk: k(14, 22), deposit: '1–2 months', brokerage: 'Rare' },
  trichy: { bhk1: k(6, 9), bhk2: k(9, 14), house3bhk: k(14, 22), deposit: '2–3 months', brokerage: 'Rare' },
  vellore: { bhk1: k(5, 8), bhk2: k(8, 12), house3bhk: k(13, 20), deposit: '2–3 months', brokerage: 'Rare' },
  'chennai-kelambakkam': { bhk1: k(9, 13), bhk2: k(13, 19), house3bhk: k(22, 32), deposit: '3–5 months', brokerage: '~1 month' },
}

// prettier-ignore
const RUNNING: Record<string, Running> = {
  delhi: [inr(1000, 2500), inr(300, 1000), inr(500, 800), inr(4500, 6500), inr(2000, 3500), inr(1000, 2000), inr(2000, 3500)],
  kurukshetra: [inr(900, 2000), inr(200, 500), inr(500, 700), inr(4000, 5500), inr(1500, 2500), inr(600, 1200), inr(1500, 2500)],
  prayagraj: [inr(1000, 2500), inr(200, 500), inr(500, 700), inr(4000, 5500), inr(1500, 2500), inr(800, 1500), inr(1500, 2500)],
  bhopal: [inr(900, 2000), inr(300, 800), inr(500, 700), inr(4000, 6000), inr(1500, 3000), inr(800, 1500), inr(1500, 2500)],
  raipur: [inr(900, 2200), inr(200, 600), inr(500, 700), inr(4000, 5500), inr(1500, 2500), inr(800, 1500), inr(1500, 2500)],
  patna: [inr(1000, 2500), inr(200, 600), inr(500, 700), inr(4000, 6000), inr(1500, 2500), inr(800, 1500), inr(1500, 2500)],
  jamshedpur: [inr(800, 1800), inr(200, 600), inr(500, 700), inr(4000, 5500), inr(1500, 2500), inr(800, 1500), inr(1500, 2500)],
  agartala: [inr(800, 1500), inr(200, 500), inr(500, 700), inr(4000, 5500), inr(1500, 2500), inr(1500, 2500), inr(1500, 2500)],
  shillong: [inr(700, 1500), inr(300, 800), inr(600, 900), inr(4500, 6500), inr(2000, 3000), inr(1500, 3000), inr(2000, 3000)],
  warangal: [inr(800, 1800), inr(200, 500), inr(500, 700), inr(3500, 5000), inr(1500, 2500), inr(800, 1500), inr(1500, 2500)],
  trichy: [inr(800, 2000), inr(200, 600), inr(500, 700), inr(3500, 5000), inr(1500, 2500), inr(1000, 2000), inr(1500, 2500)],
}

// prettier-ignore
const PG: Record<string, Pg> = {
  delhi: { single: k(9, 13), double: k(7, 9), triple: k(5.5, 7), deposit: '1 month', acLaundry: k(0.8, 2), transport: k(1, 2), misc: k(2.5, 3.5), totalSingle: k(13.5, 20.5), totalDouble: k(11.5, 16.5) },
  kurukshetra: { single: k(7, 10), double: k(5, 7), triple: k(4, 5.5), deposit: '1 month', acLaundry: k(0.7, 1.5), transport: k(0.6, 1.2), misc: k(2, 3), totalSingle: k(10.5, 15.5), totalDouble: k(8.5, 12.5) },
  prayagraj: { single: k(7, 10), double: k(5, 7), triple: k(4, 5.5), deposit: '1 month', acLaundry: k(0.8, 2), transport: k(0.8, 1.5), misc: k(2, 3), totalSingle: k(10.5, 16.5), totalDouble: k(8.5, 13.5) },
  bhopal: { single: k(8, 12), double: k(6, 8), triple: k(5, 6.5), deposit: '1 month', acLaundry: k(0.6, 1.5), transport: k(0.8, 1.5), misc: k(2, 3), totalSingle: k(11.5, 18), totalDouble: k(9.5, 14) },
  raipur: { single: k(7, 10), double: k(5, 7), triple: k(4, 5.5), deposit: '1 month', acLaundry: k(0.8, 2), transport: k(0.8, 1.5), misc: k(2, 3), totalSingle: k(10.5, 16.5), totalDouble: k(8.5, 13.5) },
  patna: { single: k(8, 11), double: k(6, 8), triple: k(4.5, 6), deposit: '1 month', acLaundry: k(0.8, 2), transport: k(0.8, 1.5), misc: k(2, 3), totalSingle: k(11.5, 17.5), totalDouble: k(9.5, 14.5) },
  jamshedpur: { single: k(7, 10), double: k(5, 7), triple: k(4, 5.5), deposit: '1 month', acLaundry: k(0.6, 1.5), transport: k(0.8, 1.5), misc: k(2, 3), totalSingle: k(10.5, 16), totalDouble: k(8.5, 13) },
  agartala: { single: k(7, 10), double: k(5, 7), triple: k(4, 5.5), deposit: '1 month', acLaundry: k(0.5, 1.2), transport: k(1.5, 2.5), misc: k(2, 3), totalSingle: k(11, 17), totalDouble: k(9, 14) },
  shillong: { single: k(9, 13), double: k(7, 9), triple: k(5.5, 7), deposit: '1 month', acLaundry: k(0.4, 1), transport: k(1.5, 3), misc: k(2.5, 3.5), totalSingle: k(13.5, 20.5), totalDouble: k(11.5, 16.5) },
  warangal: { single: k(6.5, 9), double: k(5, 6.5), triple: k(4, 5), deposit: '1 month', acLaundry: k(0.6, 1.5), transport: k(0.8, 1.5), misc: k(2, 3), totalSingle: k(10, 15), totalDouble: k(8.5, 12.5) },
  trichy: { single: k(7, 10), double: k(5, 7), triple: k(4, 5.5), deposit: '1 month', acLaundry: k(0.6, 1.5), transport: k(1, 2), misc: k(2, 3), totalSingle: k(10.5, 16.5), totalDouble: k(8.5, 13.5) },
  vellore: { single: k(6, 9), double: k(4.5, 6.5), triple: k(4, 5), deposit: '1 month', acLaundry: k(0.6, 1.5), transport: k(0.8, 1.5), misc: k(2, 3), totalSingle: k(9.5, 15), totalDouble: k(8, 12.5) },
  'chennai-kelambakkam': { single: k(9, 13), double: k(7, 9.5), triple: k(5.5, 7), deposit: '1–2 months', acLaundry: k(0.8, 2), transport: k(1, 2.5), misc: k(2.5, 3.5), totalSingle: k(13.5, 21), totalDouble: k(11.5, 17.5) },
}

/**
 * Where a city borrows a table it does not have in SPEC (decision log, gap 1 and VIT Bhopal).
 * Borrowed costs are marked `estimate` with a note.
 */
const BORROW: Record<string, { rent?: string; running?: string; pg?: string }> = {
  vellore: { running: 'trichy' },
  'chennai-kelambakkam': { running: 'delhi' },
  sehore: { rent: 'bhopal', running: 'bhopal', pg: 'bhopal' },
}

function buildCosts(id: string): CityCosts | null {
  const b = BORROW[id] ?? {}
  const rent = RENT[b.rent ?? id]
  const running = RUNNING[b.running ?? id]
  const pg = PG[b.pg ?? id]
  if (!rent || !running || !pg) return null

  const [electricity, waterMaint, wifi, food, maidCook, transport, misc] = running
  const runningTotal = addRanges(...running)
  const borrowed = Object.entries(b).map(([table, from]) => `${table} from ${from}`)

  return {
    // PG totals are taken as written in SPEC §11.5 (they include rounding).
    pgSingleAllIn: pg.totalSingle,
    pgDoubleAllIn: pg.totalDouble,
    // SPEC §11.4 formulas.
    flat1bhkAllIn: addRanges(rent.bhk1, runningTotal),
    flat2bhkAllIn: addRanges(rent.bhk2, runningTotal, k(1, 1)),
    bungalowAllIn: addRanges(rent.house3bhk, runningTotal, k(2, 4)),
    rent: { bhk1: rent.bhk1, bhk2: rent.bhk2, house3bhk: rent.house3bhk },
    pgRentWithFood: { single: pg.single, double: pg.double, triple: pg.triple },
    pgExtras: { acLaundry: pg.acLaundry, transport: pg.transport, misc: pg.misc },
    running: { electricity, waterMaint, wifi, food, maidCook, transport, misc },
    runningTotal,
    depositMonths: rent.deposit,
    pgDepositMonths: pg.deposit,
    brokerage: rent.brokerage,
    confidence: 'estimate',
    source: SOURCES.costs,
    ...(borrowed.length > 0 && {
      note: `Not in SPEC for this city; borrowed: ${borrowed.join(', ')}.`,
    }),
  }
}

// ---------- Air quality (SPEC §11.2) ----------

const official = (value: number): Sourced<number> => ({
  value,
  confidence: 'official',
  source: SOURCES.aqiCpcb,
  asOf: AS_OF.aqi,
})

const estimateRange = (min: number, max: number): Sourced<number> => ({
  value: mid(min, max),
  confidence: 'estimate',
  source: SOURCES.chatResearch,
  asOf: AS_OF.aqi,
  note: `Estimated range ${min}–${max}; midpoint stored.`,
})

function fromPm25(pm25: number): { annualAQI: Sourced<number>; pm25Annual: Sourced<number> } {
  const naqi = pmToNaqi(pm25)
  if (!naqi) throw new Error('unreachable')
  return {
    pm25Annual: { value: pm25, confidence: 'aggregator', source: SOURCES.smartAir, asOf: '2025' },
    annualAQI: {
      value: naqi.aqi,
      confidence: 'aggregator',
      source: SOURCES.smartAir,
      asOf: '2025',
      note: `Derived from annual mean PM2.5 ${pm25} µg/m³ with the NAQI PM2.5 bands (24-h bands applied to an annual mean — approximate).`,
    },
  }
}

const noData: Sourced<number> = { value: null, confidence: 'none' }

const officialDays = (value: number): Sourced<number> => ({
  value,
  confidence: 'official',
  source: SOURCES.aqiCpcb,
  asOf: AS_OF.aqi,
})

// ---------- Cities ----------

type CityRow = Omit<City, 'costs' | 'distanceFromHomeKm'>

// prettier-ignore
const ROWS: CityRow[] = [
  {
    id: 'delhi', name: 'Delhi (Narela)', state: 'Delhi', region: 'North', lat: 28.6139, lng: 77.209, excluded: false,
    annualAQI: official(200), poorDaysPerYear: officialDays(164), worstMonth: 'Nov', livingScore: 5,
    pros: 'Big-city access', watchOuts: 'Worst air (200), outskirts location',
  },
  {
    id: 'kurukshetra', name: 'Kurukshetra', state: 'Haryana', region: 'North', lat: 29.9695, lng: 76.8783, excluded: false,
    annualAQI: estimateRange(120, 140), worstMonth: 'Oct–Dec (stubble burning)', livingScore: 6,
    pros: 'Cheap small town; Chandigarh ~1.5 h', watchOuts: 'Stubble-burning season air; limited amenities',
  },
  {
    id: 'prayagraj', name: 'Prayagraj', state: 'Uttar Pradesh', region: 'North', lat: 25.4358, lng: 81.8463, excluded: false,
    annualAQI: official(85), poorDaysPerYear: officialDays(7), worstMonth: 'Nov', livingScore: 7.5,
    pros: 'Very cheap, huge PG supply (coaching hub)', watchOuts: 'Nov–Jan smog, Magh Mela crowds, hot summers',
  },
  {
    id: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', region: 'Central', lat: 23.2599, lng: 77.4126, excluded: false,
    annualAQI: official(112), poorDaysPerYear: officialDays(29), worstMonth: 'Nov', livingScore: 8.5,
    pros: 'Lakes, greenery, wide roads, affordable — best living standard of the list', watchOuts: 'Moderate air; worst in Nov',
  },
  {
    id: 'raipur', name: 'Raipur', state: 'Chhattisgarh', region: 'Central', lat: 21.2514, lng: 81.6296, excluded: false,
    annualAQI: official(70), poorDaysPerYear: officialDays(0), worstMonth: 'Jan', livingScore: 7,
    pros: 'Cheap, satisfactory air year-round; Naya Raipur well planned', watchOuts: 'Weak MCA placements; very hot summers',
  },
  {
    id: 'patna', name: 'Patna', state: 'Bihar', region: 'East', lat: 25.5941, lng: 85.1376, excluded: false,
    annualAQI: official(131), poorDaysPerYear: officialDays(54), worstMonth: 'Jan', livingScore: 5,
    pros: 'Central campus', watchOuts: 'Poor air (131), congestion',
  },
  {
    id: 'jamshedpur', name: 'Jamshedpur', state: 'Jharkhand', region: 'East', lat: 22.8046, lng: 86.2029, excluded: false,
    annualAQI: estimateRange(100, 120), livingScore: 8,
    pros: "One of India's best-planned cities; clean, safe, reliable utilities", watchOuts: 'Steel-city air; more service-company recruiters',
  },
  {
    id: 'agartala', name: 'Agartala', state: 'Tripura', region: 'NorthEast', lat: 23.8315, lng: 91.2868, excluded: false,
    ...fromPm25(20.3), worstMonth: 'Winter', livingScore: 5,
    pros: 'Clean air', watchOuts: 'Remote; campus ~20 km out; flights needed',
  },
  {
    id: 'shillong', name: 'Shillong', state: 'Meghalaya', region: 'NorthEast', lat: 25.5788, lng: 91.8933, excluded: false,
    ...fromPm25(8.5), livingScore: 6,
    pros: 'Cleanest air, scenic', watchOuts: 'Campus relocation uncertainty; rain; remote; pricier',
  },
  {
    id: 'warangal', name: 'Warangal', state: 'Telangana', region: 'South', lat: 17.9689, lng: 79.5941, excluded: false,
    annualAQI: estimateRange(60, 75), livingScore: 7, summerMaxTempC: 42,
    pros: 'Cheap, calm, decent hospitals/malls in Hanamkonda; Hyderabad ~2.5–3 h', watchOuts: 'Small city, hot summers (42 °C+)',
  },
  {
    id: 'trichy', name: 'Tiruchirappalli (Trichy)', state: 'Tamil Nadu', region: 'South', lat: 10.7905, lng: 78.7047, excluded: false,
    annualAQI: official(62), poorDaysPerYear: officialDays(1), worstMonth: 'Mar', livingScore: 6.5,
    pros: 'Very clean air, cheap, good food; trains to Chennai/Bangalore', watchOuts: 'Campus ~20 km from city; Tamil helps; humid',
  },
  {
    id: 'vellore', name: 'Vellore', state: 'Tamil Nadu', region: 'South', lat: 12.9165, lng: 79.1325, excluded: false,
    annualAQI: estimateRange(60, 75), livingScore: 6.5,
  },
  {
    id: 'chennai-kelambakkam', name: 'Chennai (Kelambakkam, OMR)', state: 'Tamil Nadu', region: 'South', lat: 12.7867, lng: 80.2206, excluded: false,
    annualAQI: { ...official(80), note: 'Chennai city figure; Kelambakkam is on the southern edge.' },
    poorDaysPerYear: officialDays(0), worstMonth: 'Dec', livingScore: 7.5,
    pros: 'IT-corridor location',
  },
  {
    id: 'sehore', name: 'Sehore (Kothri Kalan, VIT Bhopal)', state: 'Madhya Pradesh', region: 'Central', lat: 23.2032, lng: 77.0844, excluded: false,
    annualAQI: { ...estimateRange(70, 100), note: 'Rural Sehore estimate 70–100; midpoint stored.' },
    worstMonth: 'Nov', livingScore: 5,
    watchOuts: 'Remote campus ~40 km from Bhopal; hostel practically required',
  },
  // Excluded by owner rule (SPEC §2). No cost or air data: they are never ranked.
  {
    id: 'gandhinagar', name: 'Gandhinagar', state: 'Gujarat', region: 'West', lat: 23.2156, lng: 72.6369, excluded: true,
    annualAQI: noData, livingScore: null, watchOuts: 'Excluded city (near Ahmedabad)',
  },
  // Diu is not excluded, but SPEC has no air or cost data for it.
  {
    id: 'diu', name: 'Diu', state: 'Dadra and Nagar Haveli and Daman and Diu', region: 'West', lat: 20.7144, lng: 70.9874, excluded: false,
    annualAQI: noData, livingScore: null, watchOuts: 'No cost or air data in SPEC yet',
  },
]

export const CITIES: City[] = ROWS.map((row) => ({
  ...row,
  costs: buildCosts(row.id),
  distanceFromHomeKm: Math.round(haversineKm(HOME_CITY, row)),
}))

/** Region values used in this file, for a quick sanity check in tests. */
export const CITY_REGIONS: Region[] = [...new Set(ROWS.map((r) => r.region))]
