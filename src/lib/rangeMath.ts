import type { Range } from '@/types/domain'

export const addRanges = (...rs: Range[]): Range => ({
  min: rs.reduce((s, r) => s + r.min, 0),
  max: rs.reduce((s, r) => s + r.max, 0),
})

export const scaleRange = (r: Range, k: Range | number): Range =>
  typeof k === 'number'
    ? { min: r.min * k, max: r.max * k }
    : { min: r.min * k.min, max: r.max * k.max }
