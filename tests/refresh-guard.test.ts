import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { assertNoBigDrop, countRows } from '../scripts/overpass.ts'

describe('refresh guard (unattended cron must not replace good data)', () => {
  it('accepts growth, small drops and a first run', () => {
    expect(() => assertNoBigDrop('x', 1000, 1200)).not.toThrow()
    expect(() => assertNoBigDrop('x', 1000, 500)).not.toThrow()
    expect(() => assertNoBigDrop('x', 0, 0)).not.toThrow()
  })

  it('rejects a result below half of the old count', () => {
    expect(() => assertNoBigDrop('stays.osm.json', 1005, 499)).toThrow(/Not written/)
    expect(() => assertNoBigDrop('stays.osm.json', 1005, 0)).toThrow(/Not written/)
  })

  const dir = mkdtempSync(path.join(tmpdir(), 'mca-guard-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('counts rows of an existing file, 0 when missing or broken', () => {
    const ok = path.join(dir, 'ok.json')
    const bad = path.join(dir, 'bad.json')
    writeFileSync(ok, JSON.stringify({ data: [1, 2, 3] }))
    writeFileSync(bad, '{not json')
    const count = (j: unknown) => (j as { data: unknown[] }).data.length
    expect(countRows(ok, count)).toBe(3)
    expect(countRows(bad, count)).toBe(0)
    expect(countRows(path.join(dir, 'missing.json'), count)).toBe(0)
  })
})
