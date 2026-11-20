/* MCA Stay Finder service worker (SPEC §12 "offline-ish", §13 item 10).
 * Registered only in production builds (see src/main.tsx). Plain JS, no build step.
 *
 *   app files (same origin)  → network first, cache fallback (fresh when online, works offline)
 *   data/*.json              → network first; a cached answer carries "x-sw-cache: 1" so the app
 *                              can show "using cached data"
 *   map tiles / fonts        → stale-while-revalidate, capped (areas viewed before work offline)
 *   everything else          → not touched (Open-Meteo and Nominatim have their own app caches)
 */
const VERSION = 'v1'
const APP_CACHE = `app-${VERSION}`
const TILE_CACHE = `tiles-${VERSION}`
const MAX_TILES = 1500
const TILE_HOSTS = ['tiles.openfreemap.org', 'tile.openstreetmap.org']

self.addEventListener('install', (event) => {
  // Cache the entry page so a first offline reload has something to show.
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((c) => c.addAll(['./', './index.html']).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => ![APP_CACHE, TILE_CACHE].includes(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function markedFromCache(cached) {
  const headers = new Headers(cached.headers)
  headers.set('x-sw-cache', '1')
  return new Response(await cached.blob(), {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  })
}

async function networkFirst(request, { isData, isNavigation }) {
  const cache = await caches.open(APP_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (isNavigation ? (await cache.match('./index.html')) || (await cache.match('./')) : undefined)
    if (!cached) throw err
    return isData ? markedFromCache(cached) : cached
  }
}

async function trimTiles(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i])
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(TILE_CACHE)
  const cached = await cache.match(event.request)
  const network = fetch(event.request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(event.request, response.clone())
        await trimTiles(cache)
      }
      return response
    })
    .catch(() => undefined)
  if (cached) {
    event.waitUntil(network)
    return cached
  }
  const fresh = await network
  return fresh || new Response('', { status: 504, statusText: 'Offline tile' })
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    const isData = url.pathname.includes('/data/') && url.pathname.endsWith('.json')
    const isNavigation = request.mode === 'navigate'
    // Vite dev files and HMR are never cached (the worker only runs in production anyway).
    if (url.pathname.startsWith('/@') || url.pathname.includes('/node_modules/')) return
    event.respondWith(networkFirst(request, { isData, isNavigation }))
    return
  }

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event))
  }
})
