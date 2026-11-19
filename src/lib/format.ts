import type { Range } from '@/types/domain'

/** ₹ amount in thousands: 8500 → "8.5k". */
export const inrK = (n: number): string => `${Number((n / 1000).toFixed(1))}k`

/** ₹8.5k–12.5k */
export const formatInrRange = (r: Range | null | undefined): string =>
  r ? `₹${inrK(r.min)}–${inrK(r.max)}` : '–'
