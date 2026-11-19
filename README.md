# MCA Campus & Stay Finder

A personal decision dashboard. It helps pick an MCA college (NITs via NIMCET, VIT as backup), a city, and a place to stay near campus. It uses a live map, filters and a weighted score.

- Full spec: [SPEC.md](SPEC.md)
- Working summary and decisions log: [CLAUDE.md](CLAUDE.md)

## Cost

₹0. The app uses only free, open-source libraries and free public APIs. There is no backend.

## Run it

Requirements: Node 20 or later.

```bash
npm install
npm run dev
```

Open the URL that Vite prints (usually http://localhost:5173).

## Scripts

| Command              | What it does                    |
| -------------------- | ------------------------------- |
| `npm run dev`        | Start the dev server            |
| `npm run build`      | Type-check and build to `dist/` |
| `npm run preview`    | Serve the built app             |
| `npm test`           | Run unit tests once (Vitest)    |
| `npm run test:watch` | Run tests in watch mode         |
| `npm run lint`       | Lint with oxlint                |
| `npm run format`     | Format with Prettier            |
| `npm run typecheck`  | Type-check only                 |

## Optional API keys

The app needs no keys. To use the optional sources, copy `.env.example` to `.env.local` and add the keys. `.env.local` is git-ignored.

## Data and attribution

- Map data © OpenStreetMap contributors. Tiles by OpenFreeMap.
- Live air quality: Open-Meteo (CAMS model data, labelled "modelled").
- Costs are estimates, not live listings. Placement figures are mostly from aggregators. See the "Data sources" modal in the app.

## Status

See the phase table in [CLAUDE.md](CLAUDE.md).
