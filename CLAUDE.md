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
- Data scripts (from Phase 1): `npm run data:seed` · `npm run data:osm` · `npm run data:all`
- Run all checks before each phase commit: `npm run lint && npm run typecheck && npm test && npm run build`.

## Layout of the code

- `src/app/` app shell (App, TopBar, StatusBar) · `src/components/{filters,map,results,tools}` · `src/components/ui/` shadcn (generated, do not hand-edit)
- `src/lib/` pure logic · `src/store/` Zustand + Dexie · `src/types/` types + zod · `tests/` Vitest · `scripts/` data pipelines · `public/data/` JSON
- Import alias `@/` = `src/`.

## Build phases (SPEC §14) — commit at the end of each

| #   | Phase                                               | Status  |
| --- | --------------------------------------------------- | ------- |
| 0   | Setup, 3-column empty layout                        | done    |
| 1   | Seed data JSON + zod schemas                        | pending |
| 2   | Map, college markers, AQI circles, legend           | pending |
| 3   | Filters, scoring, ranked table, URL sync, presets   | pending |
| 4   | OSM stays, clustering, radius ring, deep links      | pending |
| 5   | Dexie owner tools, export/import, budget calc       | pending |
| 6   | Live AQI (Open-Meteo), amenities                    | pending |
| 7   | Charts, compare, dark mode, mobile, a11y, data-info | pending |
| 8   | Optional: Actions cron, Pages deploy                | pending |

## Decisions log

Format: date — decision — reason.

- 2026-11-20 — Ranges in seed (for example AQI "~60–75") are stored as the midpoint with `confidence: 'estimate'` and the raw range in `source` note. — Filters and scoring need one number.
- 2026-11-20 — Agartala and Shillong annual NAQI are derived from PM2.5 with `naqi.ts` (20.3 → ~34 Good; 8.5 → ~14 Good). — SPEC gives PM2.5 only.
- 2026-11-20 — Seed and computed sub-scores can differ (for example Warangal air: seed 8.5, formula ~6.6). The app uses seed values in Phase 1–2 and switches to computed values in Phase 3, with a toggle to compare. — SPEC §10 says "seed until computed".
- 2026-11-20 — Owner accepted the default plan for all 6 gaps below. — Phase 0 go-ahead.
- 2026-11-20 — Toolchain: Vite 8, React 19, TypeScript 7 (strict + `noUncheckedIndexedAccess`), Tailwind 4, shadcn/ui (Radix, Nova preset), Vitest 5. — Current `create-vite` template.
- 2026-11-20 — Lint with **oxlint**, not ESLint (SPEC §12 says ESLint). — The Vite template ships oxlint. ESLint's TypeScript parser may not support TypeScript 7 yet. oxlint uses ESLint-compatible rules and runs faster. Prettier is used as SPEC says.
- 2026-11-20 — `vite.config.ts` uses `base: './'`. — The static build then also works on a GitHub Pages sub-path (Phase 8).

## Gaps found in SPEC (defaults accepted 2026-11-20)

1. §11.4 has no running-cost rows for Vellore and Chennai–Kelambakkam. Plan: estimate from Trichy (Vellore) and Delhi (Chennai) and mark `estimate`.
2. §11.6 localities exist only for the top 6 NITs. Other campuses show OSM stays + city ranges only.
3. VIT colleges have no seed sub-scores, only a manual final score. Plan: derive sub-scores so the formula works, mark `estimate`.
4. "Max train hours from Surat" has no free data source. Plan: straight-line km from Surat now; train hours as a manual seed field.
5. Acceptance "works with network off": data loads from cached JSON, but basemap tiles need the network. Plan: service-worker cache of visited tiles; unvisited areas show blank with a banner.
6. Cost sub-score is relative to visible cities, so scores shift when filters change. Plan: keep SPEC behaviour, show a note in the score tooltip.
