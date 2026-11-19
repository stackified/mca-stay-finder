# MCA Campus & Stay Finder — Project Spec (for Claude Code)

> **Read this whole file before writing any code.** It is the single source of truth for this project.
> Start by creating a `CLAUDE.md` that summarises this spec, then propose a plan, then build phase by phase (Section 14).
> If anything here is ambiguous or impossible for free, **stop and ask the owner** — don't silently swap in a paid service.

---

## 0. TL;DR

| Item | Decision |
|---|---|
| What | Personal decision dashboard: a **live interactive map + filter panel** to pick an MCA college (NITs via NIMCET, VIT as backup), the **city**, and the **place to stay** (PG / flat / bungalow / hostel) near that campus |
| Who | One user (the owner), personal use, desktop-first but must work on mobile |
| Core idea | Every filter change updates **the map, the ranked list, and the charts instantly** — no page reloads, no "submit" button |
| Budget | **₹0.** Only free, keyless (or free-key, no-credit-card) services and open-source libraries |
| Hosting | Runs locally (`npm run dev`); optional free deploy to GitHub Pages / Cloudflare Pages |
| Backend | **None.** Static JSON data + browser-side logic + free public APIs. Data refresh via local scripts / free GitHub Actions cron |

---

## 1. Problem statement

The owner (a working software engineer based in **Surat, Gujarat**) plans to do an **MCA**. He is targeting **NITs through NIMCET**, with **VIT (via VITMEE)** as backup. He wants to live in a **PG or rented flat/bungalow close to campus** (campus hostel is only a backup — he'll visit hostels before deciding).

Choosing involves trade-offs across placements, air quality, cost of living, standard of living, and distance from campus. Today this means re-asking an AI chat every time a preference changes. The dashboard lets him **slice the data himself, visually, on a map**, and keep a shortlist.

---

## 2. Owner's hard preferences (bake these in as defaults)

| Preference | Rule in the app |
|---|---|
| College type | Primary: **NITs (NIMCET)**. Backup: **VIT (VITMEE)**. Toggleable |
| Excluded cities | **Ahmedabad, Gandhinagar, Vadodara, Mumbai, Pune, and cities around Ahmedabad and Mumbai** → hidden by default (an "Excluded" toggle can reveal them greyed out). This removes IIIT Vadodara (Gandhinagar campus) |
| Air quality | Prefers **good AQI / low pollution** |
| Cost | Prefers **low rent and low total monthly expense** |
| Standard of living | Must be able to **maintain a good standard of living** |
| Distance | Stay must be **close to the chosen campus** |
| Placements | Wants a campus with **strong placements from good companies** |
| Stay type | Prefers **PG or rented apartment/bungalow**; **campus hostel = backup** |
| Home city | **Surat** (used only for "distance/travel time from home" — city-level, never a street address) |

---

## 3. Goals

1. Filter colleges, cities, and stays with **15+ independent filters** and see results update on the map in **< 300 ms** after each change (local data).
2. Show **real places** (hostels, PGs, guest houses, named apartment buildings) around each campus as map markers, sourced free from OpenStreetMap, plus the owner's **own saved listings**.
3. Rank campuses with an **adjustable weighted score** (placements / air / cost / living standard), defaulting to 40 / 25 / 20 / 15.
4. Let the owner **shortlist, annotate, compare (up to 3), and export** options.
5. Be **honest about data quality**: every number carries a source, a date, and a confidence flag (`official`, `aggregator`, `estimate`).

## 4. Non-goals (v1)

| Non-goal | Why |
|---|---|
| Scraping NoBroker / MagicBricks / 99acres / Housing.com / Facebook | Against their terms of service; no free official APIs. Instead: **deep-link buttons** that open those sites pre-searched for the locality, and a **"Add my listing"** form |
| Real-time rental availability / prices | No free legal source exists. Prices are **seeded estimates** + owner-entered listing prices |
| User accounts, multi-user, cloud DB | Single user; local-first storage is enough |
| Google Maps / Mapbox | Need billing or keys; use open map stack instead |
| Booking or payments | Out of scope |
| Admission predictor from rank | Cutoff data is noisy; may come later (P2) |

---

## 5. Free tech stack (all ₹0)

| Layer | Choice | Notes |
|---|---|---|
| Build | **Vite + React + TypeScript** | `npm create vite@latest` |
| Map engine | **MapLibre GL JS** via `react-map-gl/maplibre` | Open source, supports GeoJSON clustering, heatmaps, circles natively |
| Basemap tiles | **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`) | Free, no API key, no limits for reasonable use. Fallback: CARTO Positron raster or OSM standard tiles (follow OSM tile usage policy, show attribution) |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Sliders, selects, switches, drawers, tabs |
| State | **Zustand** | One store for filters + weights; derived selectors for results |
| URL state | Sync filters to the URL query string | Presets become shareable/bookmarkable |
| Charts | **Recharts** | Cost breakdown bars, AQI monthly line, radar for scores |
| Tables | **TanStack Table** | Sortable ranked list |
| Geo math | **Turf.js** | Distance, circles (radius rings), point-in-polygon |
| Local storage | **Dexie (IndexedDB)** | Shortlist, notes, own listings, visit checklist. Plus JSON import/export |
| Place data | **Overpass API** (OpenStreetMap) | Free, no key. Query at **build time** via script, cache to JSON |
| Geocoding | **Nominatim** | Free, max **1 request/second**, set a custom User-Agent, cache results |
| Live AQI + weather | **Open-Meteo Air Quality API** + **Open-Meteo Forecast API** | Free, **no key**. Returns PM2.5, PM10, US AQI; compute Indian NAQI from PM values (Section 9) |
| Optional official AQI | CPCB real-time feed via **data.gov.in** (free key on signup) or **OpenAQ v3** (free key) | Optional; app must work without them |
| Routing / travel time (optional) | **OSRM public demo server** or **openrouteservice** (free key, daily quota) | Only for "travel time to campus"; fallback = straight-line distance × 1.3 |
| Tests | **Vitest** (+ Playwright smoke test, optional) | Test filter + scoring logic thoroughly |
| Data refresh | Node scripts in `/scripts` + optional **GitHub Actions** cron (free for public repos / free minutes) | Writes refreshed JSON into `/public/data` |
| Deploy (optional) | **GitHub Pages** or **Cloudflare Pages** | Static build |

**Rules for Claude Code:** no paid SDKs, no keys committed to git (use `.env.local`, add `.env.example`), every external API call must have a cache + graceful fallback, show map attribution (© OpenStreetMap contributors, OpenFreeMap, Open-Meteo).

---

## 6. Features & filters

### 6.1 Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│ Top bar: Presets ▾ | Weights ⚙ | Shortlist (n) | Compare | Export | ? │
├──────────────┬────────────────────────────────────┬───────────────────┤
│ FILTER PANEL │            LIVE MAP                │  RESULTS PANEL    │
│ (collapsible │  - college markers (score-colored) │  Tabs:            │
│  accordion   │  - city AQI circles / heat         │  • Ranked colleges│
│  sections)   │  - stay markers (clustered)        │  • Stays list     │
│              │  - radius rings around campus      │  • Charts         │
│              │  - amenity layer (optional)        │  • Compare        │
│              │  Layer toggles + legend            │                   │
├──────────────┴────────────────────────────────────┴───────────────────┤
│ Status bar: "11 colleges · 6 cities · 142 stays match" · data dates   │
└───────────────────────────────────────────────────────────────────────┘
```
Mobile: map full screen, filters in a bottom sheet, results in a second bottom sheet.

### 6.2 Filter groups (all update the map live)

**A. College filters**

| Filter | Control | Default |
|---|---|---|
| Institute type | Multi-select: NIT, VIT | NIT ✓, VIT ✓ (VIT markers styled as "backup") |
| Specific institutes | Searchable multi-select | All |
| MCA average package (LPA) | Range slider | 0 – max |
| Placement rate (%) | Min slider | 0 |
| Highest package (LPA) | Min slider | 0 |
| Placement data confidence | Checkboxes: official / aggregator / estimate / no data | All |
| MCA duration | Checkboxes: 2 yr / 3 yr (with 2-yr exit) | All |
| Seats | Min slider | 0 |
| Self-financing seats available | Toggle | Off |
| Campus hostel available | Toggle (backup option) | Off |
| Program fees (total) | Max slider | Max (field may be empty → "unknown" badge) |

**B. City filters**

| Filter | Control | Default |
|---|---|---|
| Annual AQI (Indian NAQI) | Max slider + quick chips: Good ≤50, Satisfactory ≤100, Moderate ≤200 | No limit |
| "Poor or worse" days per year | Max slider | No limit |
| Live AQI right now | Max slider (uses Open-Meteo, Section 9) | Off |
| Worst-month AQI | Max slider | Off |
| Cost-of-living index | Slider (low ↔ high) | No limit |
| Standard of living score | Min slider (0–10) | 0 |
| Summer max temperature | Max slider | Off |
| Region / state | Multi-select (North, Central, East, North-East, South) | All |
| Distance from home (Surat) | Max km / max train hours | Off |
| Show excluded cities | Toggle | **Off** |

**C. Stay filters**

| Filter | Control | Default |
|---|---|---|
| Stay type | Multi-select: PG, Hostel (private), Guest house, Apartment/Flat (1BHK/2BHK), Bungalow/Independent house, Campus hostel | PG + Flat + Bungalow |
| Max distance from selected campus | Slider 0.5 – 25 km, **draws a radius ring** on the map | 5 km |
| Max travel time to campus (optional) | Slider (minutes) | Off |
| All-in monthly budget (₹) | Range slider | No limit |
| Rent only (₹) | Range slider | No limit |
| Sharing | Single / Double / Triple (PG only) | Any |
| Food included | Toggle | Off |
| AC | Toggle | Off |
| Furnished | Unfurnished / Semi / Fully | Any |
| Gender | Boys / Girls / Co-living / Any | Any |
| Amenities within X m | Checkboxes: grocery, hospital/clinic, gym, pharmacy, bus stop, railway station, restaurant/mess | Off |
| Source | OSM-mapped / My listings | Both |
| Status | Not visited / Shortlisted / Visited / Rejected | All |

**D. Scoring weights (top bar ⚙)**

| Weight | Default |
|---|---|
| Placements | 40 |
| Air quality | 25 |
| Cost | 20 |
| Living standard + housing near campus | 15 |

Sliders must always sum to 100 (auto-rebalance others). Ranking, marker colors, and list order update instantly.

**E. Presets (one click)**

| Preset | What it sets |
|---|---|
| Owner default | All Section 2 rules + default weights |
| Placement first | Weights 60/15/15/10, NIT only |
| Clean air first | Annual AQI ≤ 100, weights 30/45/15/10 |
| Cheapest good option | Avg package ≥ 9 LPA, sort by all-in cost |
| Walk to campus | Stay distance ≤ 2 km |
| Backup (VIT) | VIT only |
| Custom (saved) | Owner can save current filters as a named preset (stored in IndexedDB) |

### 6.3 Map behaviour

- **College markers**: color = final score (green ≥ 8, yellow 6–8, red < 6); size = seats; VIT markers use a dashed outline ("backup").
- **City AQI layer**: translucent circle per city colored by Indian NAQI band (Good / Satisfactory / Moderate / Poor / Very Poor / Severe). Toggle annual vs live.
- **Stay markers**: icon per type (PG, hostel, flat, bungalow, campus hostel), **clustered** when zoomed out; badge if shortlisted.
- **Radius ring**: clicking a college (or choosing it in the filter) selects it, flies the map there, draws the distance ring, and filters stays to that ring.
- **Popups / side card** on click:
  - College: placements, duration, seats, hostel, score breakdown (radar chart), "Show stays nearby" button.
  - Stay: name, type, distance + estimated commute, estimated all-in cost, source, **"Search this area on NoBroker / MagicBricks / 99acres / Housing.com"** buttons (plain links that open the site's search for the city/locality — no scraping), shortlist ★, notes, status.
- **Live update**: every filter change re-computes visible features via memoised selectors; map sources update with `setData`, never by remounting the map.
- **Empty state**: if 0 results, show which filter removed the most items and a "Relax this filter" button.
- **Layer toggles + legend** always visible.

### 6.4 Results panel

| Tab | Content |
|---|---|
| Ranked colleges | Table: rank, institute, city, avg package, placement score, AQI, air score, PG double all-in, 1BHK all-in, living score, **final score**, verdict. Sortable. Clicking a row = select college on map |
| Stays | List of matching stays near the selected campus, sorted by distance or cost |
| Charts | Cost breakdown stacked bar (rent, food, utilities, transport, misc) per city; AQI annual bar; monthly AQI line (if data); score radar |
| Compare | Pick up to 3 colleges/cities → side-by-side table of every field |

### 6.5 Owner tools

| Tool | Behaviour |
|---|---|
| Shortlist ★ | For colleges and stays; persists in IndexedDB |
| Notes | Free text per college / stay |
| Add my listing | Form: title, type, locality, campus, rent, deposit, sharing, food, AC, furnished, contact (optional), source URL, photo URL. Lat/lng via map click or Nominatim search |
| Visit checklist | Per campus/stay checklist (water, power backup, Wi-Fi speed, food quality, safety, noise, commute test, hostel inspection) with ✓ and notes |
| Budget calculator | Choose stay type + duration (2 or 3 years) → total cost incl. deposit, brokerage, one-time furnishing |
| Export / Import | Shortlist + notes + own listings as JSON and CSV |
| Data info | "Data sources & dates" modal listing every dataset, last refresh time, and confidence legend |

---

## 7. User stories (priority order)

1. As the owner, I want to toggle "Annual AQI ≤ 100" and instantly see only cleaner cities highlighted on the map, so I can drop polluted cities without asking anyone.
2. As the owner, I want to click NIT Warangal and see every PG/hostel/apartment within 3 km, so I can judge whether I can live close to campus.
3. As the owner, I want to drag the placement weight up and watch the ranking reorder, so I can see how sensitive my choice is to priorities.
4. As the owner, I want to filter stays by all-in budget and food included, so I only see PGs I can afford.
5. As the owner, I want to add a listing I found on a rental site, with its real price, so it appears on the map alongside OSM places.
6. As the owner, I want to shortlist and compare 3 options side by side, so I can make the final call.
7. As the owner, I want to see when each number was last updated and whether it is an estimate, so I don't over-trust stale data.
8. Edge cases: no OSM places near a campus (show "few mapped places — add your own / search rental sites"); an API is down (use cached data + banner); filters exclude everything (empty state with "relax" hint).

---

## 8. Data model (TypeScript)

```ts
type Confidence = 'official' | 'aggregator' | 'estimate' | 'none';
type Sourced<T> = { value: T | null; source?: string; asOf?: string; confidence: Confidence };
type Range = { min: number; max: number };            // INR / month unless noted

interface College {
  id: string;                    // 'nit-warangal'
  name: string;                  // 'NIT Warangal'
  type: 'NIT' | 'VIT' | 'IIIT';
  cityId: string;
  lat: number; lng: number;      // campus gate; verify via Nominatim
  entrance: 'NIMCET' | 'VITMEE';
  seats: Sourced<number>;
  selfFinancingSeats?: Sourced<number>;
  durationYears: Sourced<2 | 3>;
  exitOptionNote?: string;
  avgPackageLPA: Sourced<number>;
  medianPackageLPA?: Sourced<number>;
  highestPackageLPA?: Sourced<number>;
  placementRatePct?: Sourced<number>;
  recruitersNote?: string;
  totalFeesINR?: Sourced<number>;
  campusHostel: boolean;
  defaultScores: { placement: number; air: number; cost: number; living: number }; // 0–10 seeds
  notes?: string;
}

interface City {
  id: string; name: string; state: string; region: 'North'|'Central'|'East'|'NorthEast'|'South';
  lat: number; lng: number;
  excluded: boolean;
  annualAQI: Sourced<number>;          // Indian NAQI, CPCB-based where available
  pm25Annual?: Sourced<number>;        // µg/m³
  poorDaysPerYear?: Sourced<number>;
  worstMonth?: string;
  livingScore: number;                 // 0–10
  costs: {
    pgSingleAllIn: Range; pgDoubleAllIn: Range;
    flat1bhkAllIn: Range; flat2bhkAllIn: Range; bungalowAllIn: Range;
    rent: { bhk1: Range; bhk2: Range; house3bhk: Range };
    pgRentWithFood: { single: Range; double: Range; triple: Range };
    running: { electricity: Range; waterMaint: Range; wifi: Range; food: Range;
               maidCook: Range; transport: Range; misc: Range };
    depositMonths: string; brokerage: string;
  };
  distanceFromHomeKm?: number;         // from Surat, computed
  summerMaxTempC?: number;
}

interface Locality {                   // curated "where to live" areas near a campus
  id: string; collegeId: string; name: string;
  lat: number; lng: number;            // approximate centre, geocode to verify
  distanceKm: Range; vibe: string;
  pgDoubleAllIn: Range; flat1bhkAllIn: Range; bungalowAllIn: Range;
  fit: 'best' | 'budget' | 'comfort' | 'ok' | 'too-far';
}

interface Stay {
  id: string;
  source: 'osm' | 'mine';
  osmId?: string;
  name: string;
  type: 'pg' | 'hostel' | 'guest_house' | 'apartment' | 'bungalow' | 'campus_hostel' | 'unknown';
  lat: number; lng: number;
  nearestCollegeId: string; distanceKm: number;
  rent?: number; allInEstimate?: Range;   // estimate = locality/city range when no real price
  sharing?: 'single'|'double'|'triple'; food?: boolean; ac?: boolean;
  furnished?: 'none'|'semi'|'full'; gender?: 'boys'|'girls'|'coliving'|'any';
  url?: string; phone?: string; photoUrl?: string;
  tags?: Record<string,string>;           // raw OSM tags
}

interface UserState {                     // IndexedDB
  shortlist: { kind: 'college'|'stay'|'city'; id: string; addedAt: string }[];
  notes: Record<string, string>;
  status: Record<string, 'not_visited'|'shortlisted'|'visited'|'rejected'>;
  checklist: Record<string, Record<string, boolean>>;
  presets: { name: string; filters: unknown; weights: unknown }[];
  myListings: Stay[];
}
```

---

## 9. Data pipelines (scripts in `/scripts`, output to `/public/data`)

| Script | What it does | Output |
|---|---|---|
| `seed.ts` | Converts the seed tables in Section 11 into JSON | `colleges.json`, `cities.json`, `localities.json` |
| `geocode.ts` | Verifies/updates lat-lng of campuses and localities via **Nominatim** (1 req/s, User-Agent `mca-stay-finder/1.0 (personal)`), caches results | updates seed JSON + `geocode-cache.json` |
| `fetch-osm-stays.ts` | For each campus, queries **Overpass** within 10 km, normalises to `Stay`, computes distance, assigns type, dedupes | `stays.osm.json` |
| `fetch-osm-amenities.ts` | Grocery, hospital/clinic, pharmacy, gym, bus stop, railway station, restaurant within 5 km of each campus | `amenities.json` |
| `fetch-aqi.ts` | Open-Meteo Air Quality for each city (current + past days available) → compute Indian NAQI | `aqi-live.json` (the app also fetches live in the browser with a 1-hour cache) |
| `build-all.ts` | Runs all of the above in order | — |

**Overpass query template** (run per campus; wait ≥ 5 s between queries; respect rate limits):

```
[out:json][timeout:90];
(
  nwr(around:10000,{LAT},{LNG})["tourism"~"^(hostel|guest_house|apartment)$"];
  nwr(around:10000,{LAT},{LNG})["building"~"^(apartments|dormitory)$"];
  nwr(around:10000,{LAT},{LNG})["building"~"^(house|bungalow|residential)$"]["name"];
  nwr(around:10000,{LAT},{LNG})["name"~"(\\bPG\\b|paying guest|hostel|boys|girls|residency|co-?living|apartment|enclave|villa)",i];
);
out center tags;
```

Type mapping (in code): `tourism=hostel` or name ~ hostel → `hostel`; name ~ `PG|paying guest|boys|girls|co-living` → `pg`; `tourism=guest_house` → `guest_house`; `building=apartments` / `tourism=apartment` / name ~ apartment|residency|enclave → `apartment`; `building=house|bungalow` or name ~ villa|bungalow → `bungalow`; else `unknown`.
**Honest caveat to show in UI:** OSM coverage of Indian PGs is patchy — many real PGs are unmapped. That's why "My listings" and the rental-site deep links exist.

**Live AQI (browser, no key):**
`https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lng}&current=pm2_5,pm10,us_aqi&timezone=auto`
Open-Meteo values are model-based (CAMS), not CPCB station readings — label them "modelled". Keep the **CPCB-based annual AQI** in `cities.json` as the main "annual" figure.

**Convert PM to Indian NAQI** (sub-index = max of PM2.5 and PM10 sub-indices; linear interpolation within band):

| Band | NAQI | PM2.5 (24h µg/m³) | PM10 (24h µg/m³) |
|---|---|---|---|
| Good | 0–50 | 0–30 | 0–50 |
| Satisfactory | 51–100 | 31–60 | 51–100 |
| Moderate | 101–200 | 61–90 | 101–250 |
| Poor | 201–300 | 91–120 | 251–350 |
| Very Poor | 301–400 | 121–250 | 351–430 |
| Severe | 401–500 | 250+ | 430+ |

**Rental-site deep links:** build plain search URLs from city + locality name (verify each site's current URL pattern at build time; if a pattern can't be confirmed, fall back to a Google search URL like `https://www.google.com/search?q=PG+near+{locality}+{city}`). Open in a new tab. **Never fetch or parse these sites.**

---

## 10. Scoring logic

```
finalScore = (wP*placement + wA*air + wC*cost + wL*living) / 100     // weights sum to 100, each sub-score 0–10
```

| Sub-score | Computation (v1) |
|---|---|
| placement | Seed value from Section 11.1. P1: compute from avg package (60%), placement rate (25%), median (15%), min-max normalised across visible colleges; colleges with no data get 3.5 and a "no data" badge |
| air | `10 - (annualNAQI / 20)` clamped 0–10 (NAQI 0 → 10, 200 → 0). If only PM2.5 known, convert to NAQI first. Seed values used until computed |
| cost | Inverse min-max of PG-double all-in midpoint across visible cities → 0–10 |
| living | Seed value (manual, 0–10); editable by owner in the UI |

Unit-test: weights rebalance, clamping, missing data, ties, all filters combined.

---

## 11. Seed data (from research done in chat, Nov 2026)

> All money in **₹ per month** unless noted. "est." = estimate. **Placement data is mostly from aggregators (Shiksha, Collegedunia, Careers360, etc.)** — store `confidence: 'aggregator'` and let the owner overwrite with official NIRF/college reports. Costs are **estimates of typical 2026 market rates near campus**, not quoted listings.

### 11.1 Colleges (NIMCET 2026 participating NITs + VIT backup)

Source for seats: official NIMCET 2026 seat matrix (coordinated by NIT Tiruchirappalli). NIT Calicut and NIT Surathkal no longer offer MCA via NIMCET. IIIT Vadodara (Gandhinagar campus) is **excluded** by city rule; IIIT Bhopal (on MANIT campus, 90 seats) and IIIT Vadodara Diu campus (90 seats) may be added as optional `type: 'IIIT'` entries.

| id | Name | City | Approx lat, lng (verify) | Seats (2026) | Duration | MCA avg pkg (LPA) | Other placement info | Seed scores P / A / C / L | Seed final | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| nit-warangal | NIT Warangal | Warangal, Telangana | 17.984, 79.530 | 58 | 3 yr (exit at 2 yrs = PG Adv. Diploma) | 13.53 (2025) | Median 12.36, highest 39.1 LPA | 9.5 / 8.5 / 9 / 7 | 8.8 | Top pick |
| nit-trichy | NIT Tiruchirappalli | Trichy, Tamil Nadu | 10.759, 78.813 | 115 | verify | 13.16 (2025); 16.49 (2024) | ~77.5% placed 2025, highest 64.3 LPA | 9 / 9 / 8.5 / 6.5 | 8.5 | Top pick |
| mnnit-allahabad | MNNIT Allahabad | Prayagraj, UP | 25.492, 81.864 | 116 | verify | 15.49 (2026) | Max CTC 39 LPA | 9.5 / 6.5 / 8.5 / 7.5 | 8.3 | Top pick (winter-air caveat) |
| nit-jamshedpur | NIT Jamshedpur | Jamshedpur, Jharkhand | 22.777, 86.144 | 115 | 3 yr | ~9.5–10.2 | ~92% placed; EPAM, Amdocs, Capgemini | 8 / 6 / 8.5 / 8 | 7.6 | Strong |
| manit-bhopal | MANIT Bhopal | Bhopal, MP | 23.217, 77.407 | 115 | 3 yr | 11 (2025) | 90% placed 2025 | 8 / 5.5 / 8 / 8.5 | 7.5 | Strong |
| nit-raipur | NIT Raipur | Raipur, Chhattisgarh | 21.250, 81.605 | 110 | 2 yr | ~5 | Weakest of top 6 | 5.5 / 8 / 8.5 / 7 | 7.0 | Clean-air value pick |
| nit-agartala | NIT Agartala | Agartala, Tripura | 23.841, 91.423 | 60 | 3 yr | ~6–6.5 | ~68% placed; Cognizant, Virtusa | 5 / 8.5 / 8 / 5 | 6.5 | Fallback |
| nit-kurukshetra | NIT Kurukshetra | Kurukshetra, Haryana | 29.949, 76.815 | 64 + 42 SF | 3 yr | 7.97 (2026); 9.81 (2025) | 73/89 placed 2026, median 7, highest 32 LPA | 6.5 / 4 / 9 / 6 | 6.3 | Fallback |
| nit-meghalaya | NIT Meghalaya | Shillong / Sohra, Meghalaya | 25.578, 91.893 | 20 | verify | no reliable data | Campus shifting to Sohra — verify where MCA runs | 3.5 / 10 / 6 / 6 | 6.0 | Only if air is #1 |
| nit-patna | NIT Patna | Patna, Bihar | 25.620, 85.173 | 160 (2 specialisations, half SF) | verify | first MCA batch not yet placed | — | 4 / 3.5 / 7.5 / 5 | 4.7 | Skip |
| nit-delhi | NIT Delhi (Narela) | Delhi | 28.817, 77.133 | 25 (10 + 15 SF) | 2 yr | little data | — | 4.5 / 1 / 6 / 5 | 4.0 | Skip |
| vit-vellore | VIT Vellore (backup) | Vellore, Tamil Nadu | 12.969, 79.156 | verify | 2 yr | ~6–10 (unverified aggregator) | Fees ~₹2.77 L total academic (verify) | — | 7.5 (manual) | Backup #1 |
| vit-chennai | VIT Chennai (backup) | Chennai (Kelambakkam, OMR) | 12.841, 80.153 | verify | 2 yr | close to Vellore (verify) | IT-corridor location | — | 7.0 (manual) | Backup #2 |
| vit-bhopal | VIT Bhopal (backup) | Kothri Kalan, Sehore (~40 km from Bhopal) | 23.077, 76.851 | verify | 2 yr | weaker (verify) | Remote → hostel practically required | — | 5.5 (manual) | Backup #3 |

### 11.2 City air quality

| City | Annual AQI (Indian NAQI) | Poor+ days | Worst month | Confidence |
|---|---|---|---|---|
| Delhi | 200 | 164 | Nov | official (CPCB 2025 bulletins, aggregated) |
| Patna | 131 | 54 | Jan | official |
| Bhopal | 112 | 29 | Nov | official |
| Prayagraj | 85 | 7 | Nov | official |
| Chennai | 80 | 0 | Dec | official |
| Raipur | 70 | 0 | Jan | official |
| Trichy | 62 | 1 | Mar | official |
| Warangal | ~60–75 | — | — | estimate |
| Jamshedpur | ~100–120 | — | — | estimate |
| Kurukshetra | ~120–140 | — | Oct–Dec (stubble burning) | estimate |
| Agartala | PM2.5 ≈ 20.3 µg/m³ (→ Satisfactory) | — | winter | aggregator (Smart Air 2025) |
| Shillong | PM2.5 ≈ 8.5 µg/m³ (→ Good) | — | — | aggregator (Smart Air 2025) |
| Vellore | ~60–75 | — | — | estimate |
| VIT Bhopal (rural Sehore) | ~70–100 | — | Nov | estimate |

### 11.3 City costs — rent (₹/month, near campus, semi-furnished)

| City | 1BHK rent | 2BHK rent | House / bungalow (3BHK) | Deposit | Brokerage |
|---|---|---|---|---|---|
| Delhi (Narela) | 7k–11k | 10k–16k | 18k–28k (builder floor) | 2–3 months | ~1 month |
| Kurukshetra | 6k–9k | 8k–13k | 14k–22k | 1–2 months | Rare |
| Prayagraj | 6k–9k | 9k–14k | 15k–25k | 1–2 months | Rare |
| Bhopal | 7k–10k | 10k–15k | 18k–28k | 1–2 months | ~½ month |
| Raipur | 7k–10k | 10k–15k | 16k–25k | 1–2 months | Rare |
| Patna | 8k–12k | 12k–18k | 20k–30k | 1–2 months | ~½–1 month |
| Jamshedpur | 7k–10k | 10k–15k | 16k–25k | 1–2 months | Rare |
| Agartala | 6k–9k | 9k–14k | 15k–22k | 1–2 months | Rare |
| Shillong | 9k–13k | 13k–20k | 22k–35k | 1–2 months | Rare |
| Warangal | 6k–9k | 9k–13k | 14k–22k | 1–2 months | Rare |
| Trichy | 6k–9k | 9k–14k | 14k–22k | 2–3 months | Rare |
| Vellore (est.) | 5k–8k | 8k–12k | 13k–20k | 2–3 months | Rare |
| Chennai – Kelambakkam (est.) | 9k–13k | 13k–19k | 22k–32k | 3–5 months | ~1 month |

### 11.4 City costs — monthly running expenses excl. rent (1 person, flat)

| City | Electricity | Water + maint. | Wi-Fi | Food (groceries + gas) | Maid/cook | Transport | Misc | Running total |
|---|---|---|---|---|---|---|---|---|
| Delhi (Narela) | 1k–2.5k | 300–1k | 500–800 | 4.5k–6.5k | 2k–3.5k | 1k–2k | 2k–3.5k | 11.3k–19.8k |
| Kurukshetra | 900–2k | 200–500 | 500–700 | 4k–5.5k | 1.5k–2.5k | 600–1.2k | 1.5k–2.5k | 9.2k–14.9k |
| Prayagraj | 1k–2.5k | 200–500 | 500–700 | 4k–5.5k | 1.5k–2.5k | 800–1.5k | 1.5k–2.5k | 9.5k–15.7k |
| Bhopal | 900–2k | 300–800 | 500–700 | 4k–6k | 1.5k–3k | 800–1.5k | 1.5k–2.5k | 9.5k–16.5k |
| Raipur | 900–2.2k | 200–600 | 500–700 | 4k–5.5k | 1.5k–2.5k | 800–1.5k | 1.5k–2.5k | 9.4k–15.5k |
| Patna | 1k–2.5k | 200–600 | 500–700 | 4k–6k | 1.5k–2.5k | 800–1.5k | 1.5k–2.5k | 9.5k–16.3k |
| Jamshedpur | 800–1.8k | 200–600 | 500–700 | 4k–5.5k | 1.5k–2.5k | 800–1.5k | 1.5k–2.5k | 9.3k–15.1k |
| Agartala | 800–1.5k | 200–500 | 500–700 | 4k–5.5k | 1.5k–2.5k | 1.5k–2.5k | 1.5k–2.5k | 10k–15.7k |
| Shillong | 700–1.5k | 300–800 | 600–900 | 4.5k–6.5k | 2k–3k | 1.5k–3k | 2k–3k | 11.6k–18.7k |
| Warangal | 800–1.8k | 200–500 | 500–700 | 3.5k–5k | 1.5k–2.5k | 800–1.5k | 1.5k–2.5k | 8.8k–14.5k |
| Trichy | 800–2k | 200–600 | 500–700 | 3.5k–5k | 1.5k–2.5k | 1k–2k | 1.5k–2.5k | 9k–15.3k |

Formulas: `flat1bhkAllIn = rent.bhk1 + runningTotal`; `flat2bhkAllIn = rent.bhk2 + runningTotal + 1k`; `bungalowAllIn = rent.house3bhk + runningTotal + (2k..4k)`.

### 11.5 City costs — PG (food included)

| City | PG single | PG double | PG triple | Deposit | AC power + laundry | Transport | Misc | Total single | Total double |
|---|---|---|---|---|---|---|---|---|---|
| Delhi (Narela) | 9k–13k | 7k–9k | 5.5k–7k | 1 month | 800–2k | 1k–2k | 2.5k–3.5k | 13.5k–20.5k | 11.5k–16.5k |
| Kurukshetra | 7k–10k | 5k–7k | 4k–5.5k | 1 month | 700–1.5k | 600–1.2k | 2k–3k | 10.5k–15.5k | 8.5k–12.5k |
| Prayagraj | 7k–10k | 5k–7k | 4k–5.5k | 1 month | 800–2k | 800–1.5k | 2k–3k | 10.5k–16.5k | 8.5k–13.5k |
| Bhopal | 8k–12k | 6k–8k | 5k–6.5k | 1 month | 600–1.5k | 800–1.5k | 2k–3k | 11.5k–18k | 9.5k–14k |
| Raipur | 7k–10k | 5k–7k | 4k–5.5k | 1 month | 800–2k | 800–1.5k | 2k–3k | 10.5k–16.5k | 8.5k–13.5k |
| Patna | 8k–11k | 6k–8k | 4.5k–6k | 1 month | 800–2k | 800–1.5k | 2k–3k | 11.5k–17.5k | 9.5k–14.5k |
| Jamshedpur | 7k–10k | 5k–7k | 4k–5.5k | 1 month | 600–1.5k | 800–1.5k | 2k–3k | 10.5k–16k | 8.5k–13k |
| Agartala | 7k–10k | 5k–7k | 4k–5.5k | 1 month | 500–1.2k | 1.5k–2.5k | 2k–3k | 11k–17k | 9k–14k |
| Shillong | 9k–13k | 7k–9k | 5.5k–7k | 1 month | 400–1k | 1.5k–3k | 2.5k–3.5k | 13.5k–20.5k | 11.5k–16.5k |
| Warangal | 6.5k–9k | 5k–6.5k | 4k–5k | 1 month | 600–1.5k | 800–1.5k | 2k–3k | 10k–15k | 8.5k–12.5k |
| Trichy | 7k–10k | 5k–7k | 4k–5.5k | 1 month | 600–1.5k | 1k–2k | 2k–3k | 10.5k–16.5k | 8.5k–13.5k |
| Vellore (est.) | 6k–9k | 4.5k–6.5k | 4k–5k | 1 month | 600–1.5k | 800–1.5k | 2k–3k | 9.5k–15k | 8k–12.5k |
| Chennai – Kelambakkam (est.) | 9k–13k | 7k–9.5k | 5.5k–7k | 1–2 months | 800–2k | 1k–2.5k | 2.5k–3.5k | 13.5k–21k | 11.5k–17.5k |

### 11.6 Where to live — localities near the top 6 campuses (all-in ₹/month; distances approximate, verify on map)

| College | Locality | Distance to campus | Vibe | PG double | 1BHK | Bungalow | Fit |
|---|---|---|---|---|---|---|---|
| NIT Warangal | Fathima Nagar (NIT gate) | 0–1 km | Student hub, walkable | 8.5k–11k | 14.5k–20k | 24k–34k | best |
| NIT Warangal | Kazipet | 2–3 km | Cheapest, railway junction | 8k–10.5k | 14k–19k | 23k–32k | budget |
| NIT Warangal | Hanamkonda (Subedari / Nakkalagutta) | 4–6 km | Best lifestyle in city | 9.5k–12.5k | 16k–23.5k | 27k–40k | comfort |
| NIT Trichy | Thuvakudi | 0–3 km | Quiet, limited options | 8.5k–11k | 14k–19k | 22k–32k | best |
| NIT Trichy | Thiruverumbur / BHEL area | 7–10 km | Township feel | 9k–12k | 15k–21k | 24k–36k | ok |
| NIT Trichy | City (KK Nagar / Thillai Nagar) | 18–22 km | Best amenities | 10k–13.5k | 18k–24.5k | 30k–41.5k | too-far |
| MNNIT Allahabad | Teliarganj | 0–1 km | Student hub, many PGs | 9k–12.5k | 15k–22k | 26k–38k | best |
| MNNIT Allahabad | Shivkuti / Salori | 2–4 km | Cheapest | 8k–11k | 14.5k–20k | 24k–34k | budget |
| MNNIT Allahabad | Civil Lines / Ashok Nagar | 4–6 km | Best standard of living | 10.5k–13.5k | 18k–25k | 32k–45k | comfort |
| NIT Jamshedpur | Adityapur | 0–3 km | Cheapest, closest | 8k–11k | 15k–20k | 25k–35k | best |
| NIT Jamshedpur | Sonari / Kadma | 4–7 km | Green Tata township | 9k–12k | 17k–23k | 30k–42k | comfort |
| NIT Jamshedpur | Bistupur / Sakchi | 6–9 km | Main city, malls | 10k–13k | 18k–25k | 32k–44k | ok |
| MANIT Bhopal | Kotra / Mata Mandir | 0–2 km | Student area | 9.5k–12.5k | 16k–22k | 28k–40k | best |
| MANIT Bhopal | Shivaji Nagar / TT Nagar / Arera Colony | 2–5 km | Upscale, green | 11k–14k | 19k–26.5k | 35k–48.5k | comfort |
| MANIT Bhopal | MP Nagar | 4–6 km | Commercial, many PGs | 10k–13k | 17k–24k | 30k–42k | ok |
| NIT Raipur | Daganiya / Kota / Rohinipuram | 0–3 km | Student belt | 8.5k–11k | 15.5k–21k | 26k–36k | best |
| NIT Raipur | Tatibandh / Amanaka | 3–5 km | Cheaper, quieter | 8.5k–11.5k | 15.5k–21k | 26k–36k | budget |
| NIT Raipur | Shankar Nagar / Civil Lines | 5–8 km | Best standard of living | 10k–13.5k | 18k–25.5k | 32k–44.5k | comfort |

### 11.7 Living-standard notes (show in college/city side card)

| City | Pros | Watch-outs |
|---|---|---|
| Warangal | Cheap, calm, decent hospitals/malls in Hanamkonda; Hyderabad ~2.5–3 h | Small city, hot summers (42 °C+) |
| Trichy | Very clean air, cheap, good food; trains to Chennai/Bangalore | Campus ~20 km from city; Tamil helps; humid |
| Prayagraj | Very cheap, huge PG supply (coaching hub) | Nov–Jan smog, Magh Mela crowds, hot summers |
| Jamshedpur | One of India's best-planned cities; clean, safe, reliable utilities | Steel-city air; more service-company recruiters |
| Bhopal | Lakes, greenery, wide roads, affordable — best living standard of the list | Moderate air; worst in Nov |
| Raipur | Cheap, satisfactory air year-round; Naya Raipur well planned | Weak MCA placements; very hot summers |
| Agartala | Clean air | Remote; campus ~20 km out; flights needed |
| Kurukshetra | Cheap small town; Chandigarh ~1.5 h | Stubble-burning season air; limited amenities |
| Shillong | Cleanest air, scenic | Campus relocation uncertainty; rain; remote; pricier |
| Patna | Central campus | Poor air (131), congestion |
| Delhi (Narela) | Big-city access | Worst air (200), outskirts location |

### 11.8 Data sources to cite in the "Data info" modal

| Data | Source |
|---|---|
| Seats | NIMCET 2026 official seat matrix (nimcet.admissions.nic.in) |
| Placements | Shiksha, Collegedunia, Careers360, Tarkashastra, Maarula (aggregators) — replace with official NIRF/college reports when available |
| Annual AQI | CPCB daily AQI bulletins 2025, aggregated (via helloboon.com/air-quality) |
| PM2.5 Shillong/Agartala | Smart Air 2025 least-polluted-cities list |
| VIT MCA campuses | VITMEE (MCA) 2026 information brochure (vit.ac.in) |
| Costs | Estimates of typical 2026 market rates — verify on rental sites |
| Places | © OpenStreetMap contributors (Overpass API) |
| Live AQI/weather | Open-Meteo (CAMS model data) |

---

## 12. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Filter → map update < 300 ms for ≤ 5,000 stays; map stays at 60 fps panning; clustering on |
| Offline-ish | App works with cached JSON if every external API fails; banner shows "using cached data from {date}" |
| Accessibility | Keyboard-operable filters, visible focus, colour not the only signal (icons/labels on bands), WCAG AA contrast |
| Theming | Light + dark mode |
| Responsiveness | Desktop 3-column; tablet 2-column; mobile map + bottom sheets |
| Privacy | No analytics, no trackers, no personal address anywhere; home = "Surat" city only |
| Secrets | Optional keys only in `.env.local`; `.env.example` committed |
| Code quality | TypeScript strict, ESLint + Prettier, small pure functions for filtering/scoring, unit tests for them |

---

## 13. Acceptance criteria (must pass for v1)

- [ ] Setting **Annual AQI ≤ 100** hides Delhi, Patna, Bhopal (and Jamshedpur/Kurukshetra estimates) from map + ranking within 300 ms.
- [ ] Clicking **NIT Warangal** flies the map to campus, draws a ring at the current distance filter, and lists only stays inside the ring.
- [ ] Changing the **distance slider** resizes the ring and updates stay markers live.
- [ ] Moving the **placement weight** reorders the ranked table and recolours college markers; weights always total 100.
- [ ] **Excluded cities** never appear unless "Show excluded" is on (then greyed, never ranked).
- [ ] **Stay type** + **budget** + **food included** combine correctly (AND logic) — covered by unit tests.
- [ ] Owner can **add a listing**, see it on the map immediately, and it survives a page refresh.
- [ ] **Shortlist / notes / status / checklist** persist; **export → import** round-trips without data loss.
- [ ] Every number shown has a **source + date + confidence badge** on hover.
- [ ] With network off, the app still loads from cached JSON and shows the cached-data banner.
- [ ] Zero paid services, zero committed secrets.

---

## 14. Build phases (do them in order; commit at the end of each)

| Phase | Scope | Done when |
|---|---|---|
| 0 — Setup | Vite + React + TS, Tailwind, shadcn/ui, ESLint/Prettier, Vitest, folder structure, `CLAUDE.md`, `README.md` | `npm run dev` shows an empty 3-column layout |
| 1 — Seed data | `seed.ts` → `colleges.json`, `cities.json`, `localities.json` from Section 11; TS types | JSON validates against types (zod schema) |
| 2 — Map | MapLibre + OpenFreeMap, college markers, city AQI circles, legend, layer toggles, attribution | Markers render and are clickable |
| 3 — Filters + scoring | Zustand store, all college/city filters, weights, ranked table, URL sync, presets | Section 13 items 1, 4, 5 pass |
| 4 — Stays | `fetch-osm-stays.ts`, clustering, radius ring, stay filters, locality layer, rental-site deep links, empty states | Items 2, 3, 6 pass |
| 5 — Owner tools | Dexie: shortlist, notes, status, checklist, my listings, presets; export/import; budget calculator | Items 7, 8 pass |
| 6 — Live data | Open-Meteo live AQI + weather (1-h cache), PM → NAQI conversion, amenities layer | Live AQI filter works; cached fallback works |
| 7 — Polish | Charts tab, compare tab, dark mode, mobile bottom sheets, accessibility pass, data-info modal | All Section 13 items pass |
| 8 — Optional | GitHub Actions monthly data refresh; deploy to GitHub Pages / Cloudflare Pages | Live URL works |

---

## 15. Suggested folder structure

```
mca-stay-finder/
├─ CLAUDE.md                # Claude Code's working summary of this spec + decisions log
├─ SPEC.md                  # this file
├─ README.md
├─ .env.example
├─ public/data/             # colleges.json, cities.json, localities.json, stays.osm.json, amenities.json, aqi-live.json
├─ scripts/                 # seed.ts, geocode.ts, fetch-osm-stays.ts, fetch-osm-amenities.ts, fetch-aqi.ts, build-all.ts
├─ src/
│  ├─ app/                  # layout, routes (single page)
│  ├─ components/
│  │  ├─ map/               # MapView, layers, legend, popups, RadiusRing
│  │  ├─ filters/           # CollegeFilters, CityFilters, StayFilters, Weights, Presets
│  │  ├─ results/           # RankedTable, StayList, Charts, Compare
│  │  └─ tools/             # Shortlist, Notes, AddListing, Checklist, BudgetCalc, ExportImport, DataInfo
│  ├─ lib/                  # filtering.ts, scoring.ts, naqi.ts, geo.ts, deeplinks.ts, api/openMeteo.ts
│  ├─ store/                # useFilters.ts (zustand), db.ts (dexie)
│  └─ types/                # domain types + zod schemas
└─ tests/                   # filtering.test.ts, scoring.test.ts, naqi.test.ts
```

---

## 16. Open questions (ask the owner when you reach them)

| # | Question | Blocking? |
|---|---|---|
| 1 | Include IIIT Bhopal / IIIT Vadodara (Diu) as optional NIMCET entries? | No (default: include, hidden behind an "IIIT" toggle) |
| 2 | Preferred default selected campus on load (e.g. NIT Warangal)? | No |
| 3 | Deploy publicly or local-only? (Public = anyone with the link can see notes if exported data is bundled — keep user data in IndexedDB only) | No |
| 4 | Should VIT backup also include VIT-AP if it starts offering MCA? | No |
| 5 | Any extra filters wanted later (e.g. NIMCET cutoff rank, safety index, nearest airport)? | No |

---

## 17. Caveats to keep visible in the app

- Costs are **estimates**, not live listings — always verify on rental sites and during the campus visit.
- Placement figures vary by source/year; **official reports beat aggregators**.
- Several NIT MCAs now run **3 years** — the budget calculator must support 2 or 3 years.
- OSM does not map most PGs in India — **"My listings" is the real source of truth** for actual options.
- Live AQI from Open-Meteo is **modelled**, not a CPCB station reading.
