import type { StyleSpecification } from 'maplibre-gl'

/** Primary basemap: OpenFreeMap (free, no key). SPEC §5. */
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
/** Dark mode basemap (checked to exist, HTTP 200, 2026-11-20). */
export const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'

/** Glyphs for our own text layers; OpenFreeMap serves them without a key. */
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
export const LABEL_FONT = ['Noto Sans Regular']

/**
 * Fallback basemap when OpenFreeMap fails: OpenStreetMap standard raster tiles. SPEC §5.
 * Allowed for light, personal use under the OSM tile usage policy (attribution required,
 * no bulk downloading). CARTO Positron was the other SPEC option, but its tiles now return
 * "API KEY REQUIRED" (checked 2026-11-20).
 */
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS_URL,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

/** Whole of India in view on load (fits the map pane at any size). */
export const INDIA_VIEW = {
  bounds: [
    [68, 8],
    [97.5, 35.5],
  ] as [[number, number], [number, number]],
}
