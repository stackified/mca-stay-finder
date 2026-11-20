/**
 * fetch-aqi.ts — SPEC §9. Open-Meteo air quality + weather for every city → public/data/aqi-live.json.
 * The app fetches live data itself (1-hour cache); this file is the offline fallback snapshot.
 *
 *   npm run data:aqi
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fetchLiveAir } from '../src/lib/liveAir.ts'
import { buildSeed, DATA_DIR } from './seed.ts'

async function main() {
  const cities = buildSeed()['cities.json'].data
  const data = await fetchLiveAir(cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })))
  writeFileSync(path.join(DATA_DIR, 'aqi-live.json'), `${JSON.stringify(data, null, 2)}\n`)
  for (const [id, v] of Object.entries(data.byCity)) {
    console.log(
      id.padEnd(22),
      'NAQI(24h)',
      String(v.naqi).padStart(4),
      'PM2.5',
      v.pm25_24h,
      'PM10',
      v.pm10_24h,
      `${v.tempC}°C`,
    )
  }
  console.log(`wrote public/data/aqi-live.json (fetched ${data.fetchedAt})`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
