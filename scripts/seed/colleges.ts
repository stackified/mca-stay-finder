/**
 * College seed data â€” SPEC Â§11.1.
 * Placements are mostly aggregator figures. Seats are from the official NIMCET 2026 seat matrix.
 * `durationYears: null` = SPEC says "verify".
 */
import type { College, Sourced } from '../../src/types/domain.ts'
import { AS_OF, SOURCES, mid } from './util.ts'

const seats = (value: number | null, note?: string): Sourced<number> =>
  value === null
    ? { value: null, confidence: 'none', note: note ?? 'Verify' }
    : {
        value,
        confidence: 'official',
        source: SOURCES.seats,
        asOf: AS_OF.seats,
        ...(note && { note }),
      }

const duration = (value: 2 | 3 | null, note?: string): Sourced<2 | 3> =>
  value === null
    ? { value: null, confidence: 'none', note: note ?? 'Verify' }
    : { value, confidence: 'aggregator', source: SOURCES.chatResearch, ...(note && { note }) }

const agg = (value: number, asOf?: string, note?: string): Sourced<number> => ({
  value,
  confidence: 'aggregator',
  source: SOURCES.placements,
  ...(asOf && { asOf }),
  ...(note && { note }),
})

const none = (note?: string): Sourced<number> => ({
  value: null,
  confidence: 'none',
  ...(note && { note }),
})

const coordsNote = SOURCES.coords

// prettier-ignore
export const COLLEGES: College[] = [
  {
    id: 'nit-warangal', name: 'NIT Warangal', type: 'NIT', cityId: 'warangal', lat: 17.984, lng: 79.53, coordsNote,
    entrance: 'NIMCET', seats: seats(58), durationYears: duration(3),
    exitOptionNote: 'Exit at 2 years = PG Advanced Diploma',
    avgPackageLPA: agg(13.53, '2025'), medianPackageLPA: agg(12.36, '2025'), highestPackageLPA: agg(39.1, '2025'),
    campusHostel: true,
    defaultScores: { placement: 9.5, air: 8.5, cost: 9, living: 7 }, seedFinal: 8.8, verdict: 'Top pick',
  },
  {
    id: 'nit-trichy', name: 'NIT Tiruchirappalli', type: 'NIT', cityId: 'trichy', lat: 10.759, lng: 78.813, coordsNote,
    entrance: 'NIMCET', seats: seats(115), durationYears: duration(null),
    avgPackageLPA: agg(13.16, '2025', '16.49 LPA in 2024'), highestPackageLPA: agg(64.3, '2025'),
    placementRatePct: agg(77.5, '2025', 'Approximate (~77.5%)'),
    campusHostel: true,
    defaultScores: { placement: 9, air: 9, cost: 8.5, living: 6.5 }, seedFinal: 8.5, verdict: 'Top pick',
  },
  {
    id: 'mnnit-allahabad', name: 'MNNIT Allahabad', type: 'NIT', cityId: 'prayagraj', lat: 25.492, lng: 81.864, coordsNote,
    entrance: 'NIMCET', seats: seats(116), durationYears: duration(null),
    avgPackageLPA: agg(15.49, '2026'), highestPackageLPA: agg(39, '2026', 'Max CTC'),
    campusHostel: true,
    defaultScores: { placement: 9.5, air: 6.5, cost: 8.5, living: 7.5 }, seedFinal: 8.3, verdict: 'Top pick (winter-air caveat)',
  },
  {
    id: 'nit-jamshedpur', name: 'NIT Jamshedpur', type: 'NIT', cityId: 'jamshedpur', lat: 22.777, lng: 86.144, coordsNote,
    entrance: 'NIMCET', seats: seats(115), durationYears: duration(3),
    avgPackageLPA: agg(mid(9.5, 10.2), undefined, 'Range ~9.5â€“10.2 LPA; midpoint stored'),
    placementRatePct: agg(92, undefined, 'Approximate (~92%)'),
    recruitersNote: 'EPAM, Amdocs, Capgemini',
    campusHostel: true,
    defaultScores: { placement: 8, air: 6, cost: 8.5, living: 8 }, seedFinal: 7.6, verdict: 'Strong',
  },
  {
    id: 'manit-bhopal', name: 'MANIT Bhopal', type: 'NIT', cityId: 'bhopal', lat: 23.217, lng: 77.407, coordsNote,
    entrance: 'NIMCET', seats: seats(115), durationYears: duration(3),
    avgPackageLPA: agg(11, '2025'), placementRatePct: agg(90, '2025'),
    campusHostel: true,
    defaultScores: { placement: 8, air: 5.5, cost: 8, living: 8.5 }, seedFinal: 7.5, verdict: 'Strong',
  },
  {
    id: 'nit-raipur', name: 'NIT Raipur', type: 'NIT', cityId: 'raipur', lat: 21.25, lng: 81.605, coordsNote,
    entrance: 'NIMCET', seats: seats(110), durationYears: duration(2),
    avgPackageLPA: agg(5, undefined, 'Approximate (~5 LPA)'),
    campusHostel: true,
    defaultScores: { placement: 5.5, air: 8, cost: 8.5, living: 7 }, seedFinal: 7.0, verdict: 'Clean-air value pick',
    notes: 'Weakest placements of the top 6',
  },
  {
    id: 'nit-agartala', name: 'NIT Agartala', type: 'NIT', cityId: 'agartala', lat: 23.841, lng: 91.423, coordsNote,
    entrance: 'NIMCET', seats: seats(60), durationYears: duration(3),
    avgPackageLPA: agg(mid(6, 6.5), undefined, 'Range ~6â€“6.5 LPA; midpoint stored'),
    placementRatePct: agg(68, undefined, 'Approximate (~68%)'),
    recruitersNote: 'Cognizant, Virtusa',
    campusHostel: true,
    defaultScores: { placement: 5, air: 8.5, cost: 8, living: 5 }, seedFinal: 6.5, verdict: 'Fallback',
  },
  {
    id: 'nit-kurukshetra', name: 'NIT Kurukshetra', type: 'NIT', cityId: 'kurukshetra', lat: 29.949, lng: 76.815, coordsNote,
    entrance: 'NIMCET', seats: seats(106, '64 regular + 42 self-financing'), selfFinancingSeats: seats(42),
    durationYears: duration(3),
    avgPackageLPA: agg(7.97, '2026', '9.81 LPA in 2025'), medianPackageLPA: agg(7, '2026'), highestPackageLPA: agg(32, '2026'),
    placementRatePct: agg(82, '2026', '73 of 89 placed'),
    campusHostel: true,
    defaultScores: { placement: 6.5, air: 4, cost: 9, living: 6 }, seedFinal: 6.3, verdict: 'Fallback',
  },
  {
    id: 'nit-meghalaya', name: 'NIT Meghalaya', type: 'NIT', cityId: 'shillong', lat: 25.578, lng: 91.893, coordsNote,
    entrance: 'NIMCET', seats: seats(20), durationYears: duration(null),
    avgPackageLPA: none('No reliable data'),
    campusHostel: true,
    defaultScores: { placement: 3.5, air: 10, cost: 6, living: 6 }, seedFinal: 6.0, verdict: 'Only if air is #1',
    notes: 'Campus shifting to Sohra â€” verify where MCA runs',
  },
  {
    id: 'nit-patna', name: 'NIT Patna', type: 'NIT', cityId: 'patna', lat: 25.62, lng: 85.173, coordsNote,
    entrance: 'NIMCET', seats: seats(160, '2 specialisations, half self-financing'),
    selfFinancingSeats: { ...seats(80), note: 'Half of 160 (derived)' },
    durationYears: duration(null),
    avgPackageLPA: none('First MCA batch not yet placed'),
    campusHostel: true,
    defaultScores: { placement: 4, air: 3.5, cost: 7.5, living: 5 }, seedFinal: 4.7, verdict: 'Skip',
  },
  {
    id: 'nit-delhi', name: 'NIT Delhi (Narela)', type: 'NIT', cityId: 'delhi', lat: 28.817, lng: 77.133, coordsNote,
    entrance: 'NIMCET', seats: seats(25, '10 regular + 15 self-financing'), selfFinancingSeats: seats(15),
    durationYears: duration(2),
    avgPackageLPA: none('Little data'),
    campusHostel: true,
    defaultScores: { placement: 4.5, air: 1, cost: 6, living: 5 }, seedFinal: 4.0, verdict: 'Skip',
  },
  // ---------- Optional IIIT entries (SPEC Â§11.1, open question 1: hidden behind the IIIT toggle) ----------
  {
    id: 'iiit-bhopal', name: 'IIIT Bhopal', type: 'IIIT', cityId: 'bhopal', lat: 23.217, lng: 77.407,
    coordsNote: 'Runs on the MANIT campus; same point as MANIT â€” verify',
    entrance: 'NIMCET', seats: seats(90), durationYears: duration(null),
    avgPackageLPA: none('No data in SPEC'),
    campusHostel: true,
    // Placement 3.5 = SPEC Â§10 "no data" value. Air/cost/living = Bhopal (same city as MANIT).
    defaultScores: { placement: 3.5, air: 5.5, cost: 8, living: 8.5 }, seedFinal: null, verdict: 'Optional (no placement data)',
  },
  {
    id: 'iiit-vadodara-diu', name: 'IIIT Vadodara (Diu campus)', type: 'IIIT', cityId: 'diu', lat: 20.7144, lng: 70.9874,
    coordsNote: 'City centre of Diu â€” campus location not verified',
    entrance: 'NIMCET', seats: seats(90), durationYears: duration(null),
    avgPackageLPA: none('No data in SPEC'),
    campusHostel: true,
    defaultScores: null, seedFinal: null, verdict: 'Optional (no data)',
  },
  {
    id: 'iiit-vadodara-gandhinagar', name: 'IIIT Vadodara (Gandhinagar campus)', type: 'IIIT', cityId: 'gandhinagar', lat: 23.2156, lng: 72.6369,
    coordsNote: 'City centre of Gandhinagar â€” campus location not verified',
    entrance: 'NIMCET', seats: seats(null, 'Not in SPEC'), durationYears: duration(null),
    avgPackageLPA: none('No data in SPEC'),
    campusHostel: true,
    defaultScores: null, seedFinal: null, verdict: 'Excluded (city rule)',
  },
  // ---------- VIT backup (VITMEE) ----------
  // Sub-scores are derived so that 40/25/20/15 weights reproduce the manual final score in SPEC (gap 3).
  {
    id: 'vit-vellore', name: 'VIT Vellore (backup)', type: 'VIT', cityId: 'vellore', lat: 12.969, lng: 79.156, coordsNote,
    entrance: 'VITMEE', seats: seats(null), durationYears: { value: 2, confidence: 'official', source: SOURCES.vit, asOf: '2026' },
    avgPackageLPA: { ...agg(mid(6, 10), undefined, 'Unverified aggregator range ~6â€“10 LPA; midpoint stored') },
    totalFeesINR: { value: 277000, confidence: 'aggregator', source: SOURCES.chatResearch, note: 'Total academic fees ~â‚¹2.77 L â€” verify' },
    campusHostel: true,
    defaultScores: { placement: 6.5, air: 8.5, cost: 9, living: 6.5 }, seedFinal: 7.5, verdict: 'Backup #1',
  },
  {
    id: 'vit-chennai', name: 'VIT Chennai (backup)', type: 'VIT', cityId: 'chennai-kelambakkam', lat: 12.841, lng: 80.153, coordsNote,
    entrance: 'VITMEE', seats: seats(null), durationYears: { value: 2, confidence: 'official', source: SOURCES.vit, asOf: '2026' },
    avgPackageLPA: none('Close to Vellore â€” verify'),
    campusHostel: true,
    defaultScores: { placement: 7, air: 7.5, cost: 6, living: 7.5 }, seedFinal: 7.0, verdict: 'Backup #2',
    notes: 'IT-corridor location',
  },
  {
    id: 'vit-bhopal', name: 'VIT Bhopal (backup)', type: 'VIT', cityId: 'sehore', lat: 23.077, lng: 76.851, coordsNote,
    entrance: 'VITMEE', seats: seats(null), durationYears: { value: 2, confidence: 'official', source: SOURCES.vit, asOf: '2026' },
    avgPackageLPA: none('Weaker â€” verify'),
    campusHostel: true,
    defaultScores: { placement: 3.8, air: 6.5, cost: 8, living: 5 }, seedFinal: 5.5, verdict: 'Backup #3',
    notes: 'Kothri Kalan, Sehore (~40 km from Bhopal). Remote â†’ hostel practically required',
  },
]
