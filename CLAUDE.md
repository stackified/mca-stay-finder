# CLAUDE.md — MCA Campus & Stay Finder

`SPEC.md` is the source of truth. This file is the short working summary plus the decisions log.
Read `SPEC.md` sections only when a task needs them.

## What it is

- A personal, single-user decision dashboard. One map + filter panel + results panel.
- It helps choose an MCA college (NITs via NIMCET; VIT via VITMEE as backup), a city, and a stay near campus.
- Every filter change updates map, ranked list and charts live (< 300 ms). No submit button. No reload.

## Hard rules

- Budget ₹0. Only free, keyless (or free-key, no card) services and open-source libraries. Ask before any paid service.
- No backend. Static JSON in `public/data` + browser logic + free public APIs.
- No secrets in git. Optional keys go in `.env.local`. Commit `.env.example`.
- Every external API call has a cache and a graceful fallback.
- Never scrape or fetch NoBroker / MagicBricks / 99acres / Housing.com / Facebook. Use plain deep links only.
- Show attribution: © OpenStreetMap contributors, OpenFreeMap, Open-Meteo.
- Privacy: no analytics, no trackers. Home = "Surat" city only, never an address.
- User data (shortlist, notes, listings) lives in IndexedDB only. Never bundle it into the build.
- Every shown number carries source + date + confidence (`official` | `aggregator` | `estimate` | `none`).

## Owner defaults (SPEC §2)

- Colleges: NIT on, VIT on (styled "backup"). IIIT behind a toggle, off by default.
- Excluded cities (hidden by default): Ahmedabad, Gandhinagar, Vadodara, Mumbai, Pune and their surroundings.
- Stay types default: PG + Flat + Bungalow. Campus hostel = backup.
- Stay radius default: 5 km.
- Weights default: Placements 40 / Air 25 / Cost 20 / Living 15. Always sum to 100.

## Stack (SPEC §5)

Vite + React + TypeScript (strict) · Tailwind + shadcn/ui · Zustand · react-map-gl/maplibre + OpenFreeMap tiles ·
Recharts · TanStack Table · Turf.js · Dexie · zod · Vitest. Data: Overpass, Nominatim (1 req/s, cached), Open-Meteo.

## Key logic

- `finalScore = (wP*placement + wA*air + wC*cost + wL*living) / 100`, sub-scores 0–10 (SPEC §10).
- `air = clamp(10 - NAQI/20, 0, 10)`.
- `cost` = inverse min-max of PG-double all-in midpoint across visible cities.
- PM2.5/PM10 → Indian NAQI by band interpolation; take the max sub-index (SPEC §9 table).
- Filters combine with AND. Excluded cities are never ranked, even when shown.

## Commands

- `npm run dev` · `npm run build` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run format`
- Data: `npm run data:seed` (write `public/data/*.json`) · `npm run data:check` (validate only). Also `data:geocode`, `data:osm`, `data:amenities`, `data:aqi`, `data:all` (all three fetches).
- Seed tables live in `scripts/seed/*.ts`. Edit them, then run `npm run data:seed`. A test fails if the JSON is stale.
- Scripts run with Node's built-in TypeScript support (`node scripts/x.ts`). Script imports use relative paths with `.ts`; files under `src/` that scripts import (`types/domain.ts`, `lib/naqi.ts`, `lib/geo.ts`) must not use the `@/` alias.
- tsconfigs: `app` = `src` (browser), `node` = `vite.config.ts` + `scripts`, `test` = `tests` + `scripts` (Node + Vitest types).
- Run all checks before each phase commit: `npm run lint && npm run typecheck && npm test && npm run build`.

## Layout of the code

- `src/app/` app shell (App, TopBar, StatusBar) · `src/components/{filters,map,results,tools}` · `src/components/ui/` shadcn (generated, do not hand-edit)
- `src/lib/` pure logic · `src/store/` Zustand + Dexie · `src/types/` types + zod · `tests/` Vitest · `scripts/` data pipelines · `public/data/` JSON
- Import alias `@/` = `src/`.

## Build phases (SPEC §14) — commit at the end of each

| #   | Phase                                               | Status |
| --- | --------------------------------------------------- | ------ |
| 0   | Setup, 3-column empty layout                        | done   |
| 1   | Seed data JSON + zod schemas                        | done   |
| 2   | Map, college markers, AQI circles, legend           | done   |
| 3   | Filters, scoring, ranked table, URL sync, presets   | done   |
| 4   | OSM stays, clustering, radius ring, deep links      | done   |
| 5   | Dexie owner tools, export/import, budget calc       | done   |
| 6   | Live AQI (Open-Meteo), amenities                    | done   |
| 7   | Charts, compare, dark mode, mobile, a11y, data-info | done   |
| 8   | Optional: Actions cron, Pages deploy                | done   |

## Decisions log

Format: date — decision — reason.

- 2026-11-20 — Ranges in seed (for example AQI "~60–75") are stored as the midpoint with `confidence: 'estimate'` and the raw range in `source` note. — Filters and scoring need one number.
- 2026-11-20 — Agartala and Shillong annual NAQI are derived from PM2.5 with `naqi.ts` (20.3 → ~34 Good; 8.5 → ~14 Good). — SPEC gives PM2.5 only.
- 2026-11-20 — Seed and computed sub-scores can differ (for example Warangal air: seed 8.5, formula ~6.6). **Superseded in Phase 3:** default = seed scores; computed scores are a toggle in the Weights popover (URL `mode=computed`). — SPEC §10 makes computing a later priority ("P1"). Computed min-max scaling is harsh: at defaults only MNNIT reaches ≥ 8.
- 2026-11-20 — Owner accepted the default plan for all 6 gaps below. — Phase 0 go-ahead.
- 2026-11-20 — Toolchain: Vite 8, React 19, TypeScript 7 (strict + `noUncheckedIndexedAccess`), Tailwind 4, shadcn/ui (Radix, Nova preset), Vitest 5. — Current `create-vite` template.
- 2026-11-20 — Lint with **oxlint**, not ESLint (SPEC §12 says ESLint). — The Vite template ships oxlint. ESLint's TypeScript parser may not support TypeScript 7 yet. oxlint uses ESLint-compatible rules and runs faster. Prettier is used as SPEC says.
- 2026-11-20 — `vite.config.ts` uses `base: './'`. — The static build then also works on a GitHub Pages sub-path (Phase 8).
- 2026-11-20 — Types are inferred from zod schemas in `src/types/domain.ts` (one source). Every JSON file is `{ meta: { generatedAt, generator, sources, notes }, data: [...] }`. — `meta` feeds the "data dates" in the status bar and the Data info modal.
- 2026-11-20 — `Sourced<T>` has an extra `note` field; a `null` value must have `confidence: 'none'` (zod refine). — Keeps "no data" honest.
- 2026-11-20 — Schema additions beyond SPEC §8: region `West`; `City.costs`, `City.livingScore`, `College.defaultScores` may be `null`; `CityCosts` adds `pgExtras`, `runningTotal`, `pgDepositMonths`, `confidence`, `source`, `note`; `City.pros`/`watchOuts`; `College.coordsNote`, `seedFinal`, `verdict`. — Needed to hold SPEC §11 data without inventing numbers.
- 2026-11-20 — IIIT entries (open question 1): IIIT Bhopal (scored with Bhopal values, placement 3.5 = "no data"), IIIT Vadodara Diu and Gandhinagar (no scores). Gandhinagar is the only excluded city in the data. — Lets the IIIT toggle and "Show excluded" be tested. Diu has no air/cost data yet.
- 2026-11-20 — Kurukshetra seats stored as 106 total (64 + 42 SF); Delhi 25 total (15 SF); Patna 160 total, 80 SF (derived from "half"). — SPEC writes them in two formats.
- 2026-11-20 — VIT Bhopal city = "Sehore" with Bhopal cost tables (estimate). — No cost data in SPEC for Kothri Kalan.
- 2026-11-20 — VIT sub-scores (P/A/C/L): Vellore 6.5/8.5/9/6.5, Chennai 7/7.5/6/7.5, Bhopal 3.8/6.5/8/5. — They reproduce the manual finals 7.5 / 7.0 / 5.5 at default weights (gap 3).
- 2026-11-20 — NAQI Severe band upper ends assumed: PM2.5 380, PM10 510 (clamp at 500). — SPEC gives only "250+" / "430+".
- 2026-11-20 — `geo.ts` uses own haversine for now; Turf.js arrives in Phase 4 for rings. — Scripts need a dependency-free helper.
- 2026-11-20 — All coordinates (campus, city, locality) are approximate, from SPEC or general knowledge. `geocode.ts` (Nominatim) must verify them before Phase 4 relies on distances.
- 2026-11-20 — **MapLibre 6 worker under Vite:** MapLibre finds its worker relative to its own module, which breaks after bundling ("Worker failed to load"). Fix in `MapView.tsx`: import `maplibre-gl/dist/maplibre-gl-worker.mjs?url`, call `maplibregl.setWorkerUrl()`, and pass the same instance as `mapLib` (react-map-gl otherwise loads a second instance). Works in dev and `vite build`. Do not remove.
- 2026-11-20 — Fallback basemap = OSM standard raster tiles (light personal use, attribution shown). CARTO Positron tiles now return "API KEY REQUIRED", so they are not free/keyless any more. Fallback triggers only when the basemap download fails before first load.
- 2026-11-20 — College markers are DOM `<Marker>` buttons (17 items: keyboard focus, aria-label, dashed CSS border for VIT). Stays (thousands) will use GL circle layers with clustering in Phase 4.
- 2026-11-20 — AQI circles are a GL layer with a text label per city (name, AQI, band), so colour is not the only signal. AQI band colours follow the CPCB scheme (`NAQI_BANDS` in `naqi.ts`).
- 2026-11-20 — The legend sits top-left (over Pakistan, no markers there). It starts open on maps ≥ 720 px wide (India is padded right of it) and collapsed on narrower maps. It is a `<details>`, so it is always visible and one click toggles it.
- 2026-11-20 — MapView is lazy-loaded (own chunk, ~1.1 MB / 312 kB gzip). `chunkSizeWarningLimit` = 1500 kB.
- 2026-11-20 — Selected college lives in `App` state for now; Phase 3 moves it to Zustand. Selecting flies to zoom ≥ 10.
- 2026-11-20 — `npm audit` reports 4 moderate issues inside the `shadcn` CLI package (dev tooling, not shipped to the browser). Not fixed; recheck later.

### Phase 3 (filters, scoring, ranking)

- 2026-11-20 — **Never edit files with PowerShell `Get-Content`/`Set-Content`.** PowerShell 5.1 reads BOM-less UTF-8 as ANSI and garbled "§ – — ₹ ≤ µ" in 8 files (including the Phase 1 seed sources and JSON, committed in the Phase 1 commit, now 88b329a). Repaired exactly (cp1252 → UTF-8 round trip) in the Phase 3 commit. Use the Edit tool or Node for file edits.
- 2026-11-20 — Logic lives in pure modules: `lib/filters.ts` (FILTER_DEFS: isActive / test / relax / isChanged), `lib/scoring.ts` (finalScore, rebalanceWeights, computeSubScores, rankColleges), `lib/urlState.ts`, `lib/presets.ts`. `store/useAppStore.ts` holds state; `useResults()` memoises filter → score → rank.
- 2026-11-20 — Filter rules: AND logic; a filter at its default is off; when on, a missing value fails — except fees (SPEC: "unknown badge") and poor-days (only 8/16 cities have it), where unknown passes. `types` is always active (IIIT off by default) but counts as "changed" only when it differs from NIT+VIT.
- 2026-11-20 — Cost-of-living filter and cost score use the city's PG-double all-in midpoint (₹/month).
- 2026-11-20 — Computed placement: "no data" = min(3.5, lowest real score), so a college with no data never outranks one with data (SPEC says plain 3.5). Unscored colleges (any sub-score missing, e.g. Diu) rank last with "–".
- 2026-11-20 — Weights: changing one spreads the remainder over the others by their ratio (equal split if all 0), integer largest-remainder rounding, always 100.
- 2026-11-20 — Map shows AQI circles only for cities that have a visible college. Excluded colleges (when shown) are greyed markers and greyed table rows, never ranked.
- 2026-11-20 — Empty state lists, per filter, how many colleges come back if only that filter is relaxed, with a "Relax" button; falls back to raw counts when filters block jointly.
- 2026-11-20 — Filters without data are shown disabled with a reason: live AQI (Phase 6), worst-month AQI (no data), summer max temp (1 city), train hours (no free source).
- 2026-11-20 — URL keys: `type inst pmin pmax rate high conf dur seats sf hostel fees aqi poor cost living reg home excl stay w mode sort sel`. Only non-defaults are written.
- 2026-11-20 — `@tanstack/react-table` pinned to v8 (v9 has a new API). `src/components/ui/slider.tsx` has one local addition: `thumbLabels` (accessible names). The `cn` import in shadcn files is the official `cn` package from shadcn-ui.
- 2026-11-20 — Measured: a filter change updates map + table in ~90 ms in the dev build (target < 300 ms).

### Geocode (before Phase 4)

- 2026-11-20 — `npm run data:geocode [-- --apply]` checks coordinates with Nominatim (1 req/s, User-Agent `mca-stay-finder/1.0 (personal)`, cache `scripts/geocode-cache.json`, report `scripts/geocode-report.md`). Accepted points go to `scripts/seed/coords-verified.json`; `seed.ts` applies them and writes a `coordsNote` on every item.
- 2026-11-20 — Acceptance rules are strict on purpose. Loose rules matched a bus stop named "NIT Patna", an airport, a pond, a school and an "MP Nagar" in Kolar 7.6 km away. Rules: campus = university/college/educational_institution ≤ 25 km; locality = place object, moved ≤ 5 km (12 km for "too-far"), within the SPEC distance band +3 km; city = city/town (or administrative centroid ≤ 3 km).
- 2026-11-20 — Result: 37 of 51 verified, including 13 of 14 NIT/VIT campuses (moved 0.05–0.54 km). Not verified, seed kept: NIT Patna (only a bus stop found; campus may be at Bihta — verify where MCA runs), IIIT Bhopal / Vadodara-Diu / Vadodara-Gandhinagar (not in OSM search), and 9 localities.

### Phase 4 (stays)

- 2026-11-20 — `npm run data:osm` (`scripts/fetch-osm-stays.ts`, pure helpers in `scripts/osm-stays-lib.ts`). One Overpass query per campus (IIIT Bhopal shares MANIT's point), ≥ 5 s apart, back-off 15→240 s on 429/5xx, raw answers cached in `scripts/.cache/overpass` (git-ignored).
- 2026-11-20 — Overpass gotchas: (1) errors such as timeouts come back as HTTP 200 with a `remark` and no elements — treated as errors and never cached; (2) the query does ONE spatial search for named objects (`->.named`), then filters `nwr.named[...]` (a set filter needs the `nwr` prefix, `.named[...]` is HTTP 400); SPEC's four separate searches timed out on the busy public server; (3) only overpass-api.de was reachable from this machine (private.coffee and kumi.systems timed out).
- 2026-11-20 — Unnamed places are dropped. Type mapping follows SPEC §9, plus: a named `building=dormitory` within 2 km of campus = `campus_hostel`. Gender comes from the name (boys/girls/ladies/co-living). `allInEstimate` = nearest SPEC §11.6 locality within 2 km, else the city range for that stay type (estimate, not a price).
- 2026-11-20 — Stay filters live in `lib/stays.ts` and are part of `FilterState` (so presets and the URL cover them; URL keys `st stay smin bmin bmax rmin rmax share food ac furn gender src`). Type always applies (default PG + flat + bungalow); other filters only when changed. Unknown values fail an active filter — OSM has no price/food/AC/furnishing data, so those filters only match own listings (Phase 5); the UI says so. Budget = overlap of the stay's range with the budget. Sharing applies to PG/hostel only. Gender "any" also matches "not stated".
- 2026-11-20 — Distance: with a selected campus, stays within the ring of that campus; with none, within the radius of any visible campus. Commute estimate = straight line × 1.3 at 20 km/h (walk at 5 km/h shown when ≤ 2.5 road km). No routing API.
- 2026-11-20 — Map: stays are a clustered GeoJSON source (clusterMaxZoom 14, radius 40) with a letter per type (P H G A B C ?) so colour is not the only signal; clicking a cluster zooms in. Selecting a college fits its ring in view; moving the distance slider resizes the ring without moving the camera. Localities of the selected campus show with their fit label.
- 2026-11-20 — Rental deep links: SPEC wants each site's own search URL only if the pattern is confirmed, but confirming would mean fetching the sites, which SPEC forbids. So every link is the SPEC fallback: a Google search limited to the site (`site:nobroker.in` etc.) plus one open Google search. `lib/deeplinks.ts`.
- 2026-11-20 — `lib/geo.ts` gained `destination()` and `circleRing()` (own code, no Turf dependency needed so far).
- 2026-11-20 — **OSM data quality filter** (`isNotAStay` in `scripts/osm-stays-lib.ts`). The raw name-based matching produced false positives: schools/colleges with "Boys"/"Girls"/"PG" in the name ("SAM Girls' College", "TH.H.N.SINGH PG COLLEGE"), footpaths ("Route to 1.8k Hostel"), offices, a welding shop, staff housing ("Director's Bunglow"). Dropped: objects with highway/shop/office/leisure/landuse/place/… keys, non-housing amenities, and names with school/office/road/temple/quarters/shop/… — unless tagged tourism=hostel/guest_house/apartment. Kept: `landuse=residential` areas named like a housing society ("Tulsi Apartments"). Each rule has a unit test with the real example.
- 2026-11-20 — Result (2026-11-20): 1,005 stays — apartment 514, hostel 204, bungalow 90, unknown 66, guest house 63, campus hostel 62, **PG only 6**. After removing schools, OSM maps almost no PGs: own listings (Phase 5) and the rental links are the real source, as SPEC §17 warns. NIT Warangal: 4 stays within 5 km at default types; its 18 campus hostel blocks are found correctly.
- 2026-11-20 — Verified in the browser (SPEC §13): item 2 (select NIT Warangal → ring fitted, list shows only the 4 stays inside), item 3 (slider 10 km → 7 stays, 2.5 km → exactly the 2 at 2.3/2.4 km; ring, markers, list, status bar and URL agree). Item 6 is covered by unit tests.

### Phase 5 (owner tools)

- 2026-11-20 — Owner data lives only in IndexedDB (Dexie, `src/store/db.ts`, DB name `mca-stay-finder`, version 1): tables `shortlist`, `notes`, `status`, `checklist`, `presets`, `listings`. Keys: `college:<id>` / `stay:<id>`. Components read with `useLiveQuery` hooks in `src/store/useOwnerData.ts` (Maps/Sets memoised). All writes go through the functions in `db.ts`. IndexedDB is per origin: dev (5173), preview (4173) and a deployed site each have their own data — use Export/Import to move it.
- 2026-11-20 — "Not visited" status and empty notes are stored as "no row". Deleting a listing also deletes its shortlist mark, note, status and checklist (one transaction).
- 2026-11-20 — Export file = `{ app: 'mca-stay-finder', version: 1, exportedAt, shortlist, notes, status, checklist, presets, myListings }`, schema in `src/types/userData.ts`. Import validates first (zod), then REPLACES all owner data in one transaction; an invalid file changes nothing. CSV is export-only (listings; shortlist & notes) with formula-injection protection. Verified in the browser: export → wipe → import gives the same data (only JSON key order differs, from zod).
- 2026-11-20 — Own listings (`lib/listings.ts`): `source: 'mine'`, id `mine-<uuid>`, distance to the chosen campus, `allInEstimate` = your rent + the city's monthly extras (PG: AC/laundry + transport + misc, + food if not included; flat: running total; bungalow: running total + ₹2–4k). Only http(s) URLs are kept. Own listings join OSM stays in `useResults()` and are the only stays that can match rent/food/AC/furnishing filters. Map: black ring = own listing, gold ring = shortlisted, ★ badge on shortlisted college markers.
- 2026-11-20 — Listing location: "Pick on map" (form closes, crosshair + banner, Esc cancels, draft kept in the store) or Nominatim search from the browser (only on the Search button, ≥ 1.1 s apart, cached, viewbox ~30 km around the campus).
- 2026-11-20 — Stay "Status" filter (URL `vstat`) uses the owner's visit status; default = all.
- 2026-11-20 — Custom presets = the current URL query string, saved by name (`applyQuery`). Budget calculator (`lib/budget.ts`): monthly all-in × 24/36 + deposit (months × rent, PG uses PG deposit) + brokerage (flats only; "Rare" = 0) + one-time furnishing (default PG 0, 1BHK ₹40k, 2BHK ₹60k, house ₹80k — owner estimate, editable). Defaults follow the selected college's city and duration.
- 2026-11-20 — Verified in the browser: §13 item 7 (listing added via the form + map pick appears at once and survives a reload) and item 8 (shortlist, note, status, checklist survive a reload; export → import round-trips). Test data was removed afterwards.

### Phase 6 (live data)

- 2026-11-20 — Live air (`lib/liveAir.ts`): Open-Meteo air-quality + forecast APIs, free and keyless, ONE request each for all 16 cities (comma-separated lat/lng → JSON array). Live NAQI = NAQI of the **mean of the last 24 hourly PM2.5/PM10 values up to now** (needs ≥ 18 h), because NAQI bands are 24-h averages; the current hour alone would overstate peaks. Labelled "modelled (CAMS)", never presented as a CPCB reading. Weather: current temperature, humidity, today's max.
- 2026-11-20 — Cache and fallback (`lib/liveAirCache.ts`, pure, injected fetch/storage/clock): fresh localStorage cache (< 1 h, key `mca-live-air-v1`) → Open-Meteo → stale cache → `public/data/aqi-live.json` snapshot (`npm run data:aqi`) → none. Every non-fresh source shows a banner with the data date and a Retry; the status bar shows the source and a "↻ refresh" (skips the cache). Storage errors (private mode, quota) are ignored.
- 2026-11-20 — Live AQI filter (`liveAqiMax`, URL `live`): college filter on the city's live NAQI. When no live data is available at all, the filter is **paused** (not "match nothing") and the panel says so — otherwise a disabled filter could hide every college with no way to reset it.
- 2026-11-20 — Map: city circles switch between CPCB annual and live 24-h NAQI (legend radio; live disabled when unavailable). Attribution adds "Air quality & weather: Open-Meteo (CAMS)". The college card shows annual and live AQI side by side plus weather.
- 2026-11-20 — Amenities (`lib/amenities.ts`, `npm run data:amenities` → `public/data/amenities.json`): 7 kinds from SPEC (grocery, hospital/clinic, pharmacy, gym, bus stop, railway station, restaurant/mess) within 5 km of each campus, compact rows `[kind, lat, lng, name?]` per campus. Shared Overpass client in `scripts/overpass.ts`. `AmenityIndex` (0.01° grid) answers "is there a <kind> within X m" fast; checked against brute force in tests.
- 2026-11-20 — Stay filter "Amenities within X m" (`stayAmenities`, `stayAmenityRadiusM` default 500 m, URL `amen`, `amenm`): every checked kind must be within X m (straight line). No amenity data → the filter matches nothing and the panel says the data is missing. Amenity layer shows only for the selected campus, from zoom 11, with letter symbols.
- 2026-11-20 — Live snapshot seen on 2026-11-20 06:30 IST (modelled): Prayagraj 316, Delhi 294, Kurukshetra 213, Patna 211, Vellore 174, Chennai 129 … Warangal 92, Trichy 92, Bhopal 61, Agartala 42, Shillong 22. Live values can differ a lot from annual ones (Vellore annual ~68 est. vs 174 live; Bhopal annual 112 vs 61 live) — show both, decide on annual.
- 2026-11-20 — Verified in the browser: live data loads and is cached (reload makes no Open-Meteo request); `live=100` keeps exactly the 7 campuses whose cities are ≤ 100; with Open-Meteo blocked, refresh falls back to old cache → (cache cleared) snapshot → (snapshot blocked) "unavailable" with the live filter paused; unblocking + Retry returns to live.
- 2026-11-20 — Amenities result: 2,178 rows (113 kB) for 17 campuses. Coverage varies widely: NIT Patna 319, IIIT Bhopal 304, MANIT 286, NIT Warangal 251 … VIT Bhopal 10, NIT Agartala 1 (only a railway station). Verified in the browser: at NIT Warangal (10 km ring) "Grocery within 500 m" keeps exactly the 2 stays a brute-force distance check finds; the layer draws for the selected campus.
- 2026-11-20 — Browser testing note: in the scaled Browser pane, coordinate clicks inside scrolling panels/popups often miss; DOM `.click()` on the real control (which runs the app's own handler) was used where a coordinate click failed.

### Phase 7 (charts, compare, dark mode, mobile, a11y, data info)

- 2026-11-20 — Results panel has 4 tabs: Ranked, Stays, Charts (lazy chunk, Recharts), Compare. Charts: monthly cost stacked bars per city (PG double / 1BHK toggle), AQI annual vs live bars, score radar for the compared (or selected) colleges. Every chart has a source badge and a "Data table" `<details>` (screen readers, no colour-only reading). Chart data is built by pure functions in `lib/charts.ts`.
- 2026-11-20 — Compare: up to 3 colleges (`MAX_COMPARE`), URL key `cmp`; "+ Compare" on the college card, picker in the tab. Rows show values with confidence badges.
- 2026-11-20 — Dark mode: choice system → light → dark (button cycles), localStorage key `mca-theme` (per-device convenience), applied in `index.html` before first paint. Map uses OpenFreeMap `dark` style in dark mode. MapLibre popups are white by default, so `index.css` themes `.maplibregl-popup-*` under `.dark`.
- 2026-11-20 — Mobile (< 1024 px): full-height map plus a bar BELOW the map with "Filters (n)" and "Results (n)" buttons that open bottom sheets. The bar is outside the map so it never covers the map attribution. shadcn Sheet sets `data-[side=bottom]:h-auto`; a plain `h-[80dvh]` loses on specificity, so use `data-[side=bottom]:h-[80dvh]`. College card width = `min(18rem, 100vw − 7rem)`, height ≤ 40 dvh.
- 2026-11-20 — Accessibility: "Skip to results" link, landmarks, aria-labels on icon buttons, letters on markers (not colour only). `tests/a11y.test.ts` checks WCAG AA contrast (4.5:1 text, 3:1 marker fill vs white letter) for band, stay-type, amenity and chart colours; several colours were darkened to pass.
- 2026-11-20 — Badge audit (§13 item 9): Ranked table column headers, Stays cost line, locality ranges and the budget total now carry a confidence badge. Data info dialog ("?" button) lists every dataset with size, last refresh and source, the confidence legend and known caveats.
- 2026-11-20 — Offline (§13 item 10): hand-written `public/sw.js`, registered in production only. Same-origin files: network first, cache fallback; cached `data/*.json` answers carry `x-sw-cache: 1`, `loadSeedData` sets `fromCache`, and the banner says "app server unreachable" or "you are offline" with the data date. Tiles (OpenFreeMap, OSM): stale-while-revalidate, max 1,500 entries. Tiles loaded before the worker first controls the page are not cached; areas viewed after that are.
- 2026-11-20 — Verified in the browser: Charts (3 charts, radar with 3 series) and Compare (3 colleges, 30 badges) render; theme cycle and dark map work; mobile 375×812 layout has no sideways scroll, sheets are 80 % high; data info dialog opens. Offline: production preview loaded twice, server stopped, reload → app and all 14 colleges load from cache with the banner. Only `.env.example` is tracked; no keys in the code.

### Phase 8 (Actions cron, Pages deploy)

- 2026-11-20 — `.github/workflows/deploy.yml`: on push to `main` (and manual run, and when called by the refresh workflow): `npm ci` → lint → typecheck → test → build → upload `dist` → `actions/deploy-pages`. Node 24 in CI (`engines` ≥ 22.18, the first version that runs `.ts` scripts without flags). No secrets. One-time setup: repo Settings → Pages → Source = "GitHub Actions". `base: './'` makes the build work on the `/<repo>/` sub-path; the service worker scope follows.
- 2026-11-20 — `.github/workflows/refresh-data.yml`: cron `17 3 1 * *` (monthly) + manual run. Runs `data:aqi`, `data:amenities -- --fresh` and `data:osm -- --fresh` as separate steps with `continue-on-error` (a failed source keeps its old file: every script fetches everything before it writes). New data is committed by `github-actions[bot]` only after data:check, lint, typecheck, tests and build pass; then it calls deploy.yml with the new commit SHA (a push with `GITHUB_TOKEN` does not start other workflows). The run summary lists each source's result.
- 2026-11-20 — Shrink guard (`assertNoBigDrop` in `scripts/overpass.ts`): an OSM script refuses to write when the new row count is < 50 % of the old file's count (busy or partial Overpass answers); `--force` accepts it. Unit-tested.
- 2026-11-20 — Bug fixed: `fetch-osm-amenities.ts` detected "run as main" with a hand-built `file:///` URL, which never matches on Linux (`file:////home/…`), so it would silently do nothing in Actions. Now `pathToFileURL`, like `seed.ts`.
- 2026-11-20 — New `npm run data:all` = aqi + amenities (fresh) + stays (fresh).
- 2026-11-20 — Free-tier facts: GitHub Pages on a free account needs a **public** repo; Actions minutes are free on public repos. A public repo publishes all files and the commit author emails.
- 2026-11-20 — Published: public repo `stackified/mca-stay-finder`, live at https://stackified.github.io/mca-stay-finder/. First published under another account; moved to stackified on 2026-11-20 at the owner's request (new repo + history rewrite). The old repo is KEPT on the first account, by owner choice: made private, Pages turned off, both workflows disabled; its URL and old Pages URL now give 404 to the public. Do not delete it. The owner's commits use author `stackified` with the GitHub noreply address; this folder's git config uses it. The 2 data-refresh commits stay `github-actions[bot]`. Commit IDs below are the rewritten ones; the run IDs are in the old (private) repo. First Deploy run passed (build + deploy). Live site checked: data, live AQI, map and service worker (scope `/mca-stay-finder/`) load. First manual refresh run (2026-11-20, run 44725343306): AQI and stays refreshed (stays still 1,005), commit 51fb26e by github-actions[bot], redeploy passed. Amenities failed: Overpass HTTP 502 on all 5 retries (~8 min); the old amenities.json (2,178 rows, same day) was kept as designed. The run still showed green, so a `report` job was added: it runs after deploy and fails the run (GitHub emails the owner) when any source failed. Second manual run (run 44729423325): all three sources succeeded (stays 1,005, amenities 2,178), commit ebfb905, redeploy passed, report job ran and passed. The report job's failure path was checked locally with the same shell script: one failed source → exit 1 with one ::error line; no data change (deploy skipped) → exit 0.
- 2026-11-20 — Browser-pane note: when the pane is hidden, `requestAnimationFrame` does not run, so MapLibre never fires `load` and camera moves stall. Check map camera behaviour only with the pane visible.
- 2026-11-20 — Verified locally: both OSM scripts run from cache (2,178 amenity rows; stays unchanged); YAML parses (Prettier); 250 tests pass. Before publishing, the workflows could not be run (no remote).

## Gaps found in SPEC (defaults accepted 2026-11-20)

1. §11.4 has no running-cost rows for Vellore and Chennai–Kelambakkam. Plan: estimate from Trichy (Vellore) and Delhi (Chennai) and mark `estimate`.
2. §11.6 localities exist only for the top 6 NITs. Other campuses show OSM stays + city ranges only.
3. VIT colleges have no seed sub-scores, only a manual final score. Plan: derive sub-scores so the formula works, mark `estimate`.
4. "Max train hours from Surat" has no free data source. Plan: straight-line km from Surat now; train hours as a manual seed field.
5. Acceptance "works with network off": data loads from cached JSON, but basemap tiles need the network. Plan: service-worker cache of visited tiles; unvisited areas show blank with a banner.
6. Cost sub-score is relative to visible cities, so scores shift when filters change. Plan: keep SPEC behaviour, show a note in the score tooltip.
