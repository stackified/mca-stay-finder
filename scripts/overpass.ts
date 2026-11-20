/**
 * Shared Overpass client for the data scripts. One query at a time; the caller waits ≥ 5 s
 * between queries. Busy server (429/5xx) and Overpass "remark" errors (HTTP 200 with no
 * elements, e.g. a timeout) are retried with back-off 15 → 240 s; remark answers are never
 * returned as data. Only overpass-api.de was reachable from the owner's machine (2026-11-20).
 */
export type OsmElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
export const USER_AGENT = 'mca-stay-finder/1.0 (personal)'
export const PAUSE_MS = 5000

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const backoff = (attempt: number) => 15_000 * 2 ** (attempt - 1)

export async function overpass(query: string): Promise<OsmElement[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    let res: Response
    try {
      res = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(240_000),
      })
    } catch (err) {
      const wait = backoff(attempt)
      console.warn(
        `  Overpass network error (${String(err).slice(0, 80)}); retry ${attempt} in ${wait / 1000}s`,
      )
      await sleep(wait)
      continue
    }
    if (res.ok) {
      const body = (await res.json()) as { elements: OsmElement[]; remark?: string }
      if (body.remark) {
        const wait = backoff(attempt)
        console.warn(
          `  Overpass remark: ${body.remark.slice(0, 160)}; retry ${attempt} in ${wait / 1000}s`,
        )
        await sleep(wait)
        continue
      }
      return body.elements
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = backoff(attempt)
      console.warn(`  Overpass HTTP ${res.status}; retry ${attempt} in ${wait / 1000}s`)
      await sleep(wait)
      continue
    }
    throw new Error(`Overpass HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  throw new Error('Overpass: too many retries')
}
