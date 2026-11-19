import 'maplibre-gl/dist/maplibre-gl.css'
import { useMemo, useRef, useState } from 'react'
import MapGL, {
  AttributionControl,
  Layer,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
// MapLibre 6 finds its worker relative to its own module, which breaks after Vite bundles it.
// The worker file has no imports, so serving it as a plain asset works in dev and build.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { SeedData } from '@/lib/data'
import { citiesToAqiGeoJSON, collegeMarkers } from '@/lib/mapData'
import { CollegeCard } from './CollegeCard'
import { CollegeMarker } from './CollegeMarker'
import { Legend, type LayerVisibility } from './Legend'
import { FALLBACK_STYLE, INDIA_VIEW, LABEL_FONT, OPENFREEMAP_STYLE } from './mapStyle'

// Set it on the same instance that the map uses (passed below as `mapLib`).
maplibregl.setWorkerUrl(maplibreWorkerUrl)

const WIDE_MAP_PX = 720

/** True when the error is the basemap style or its tiles failing to download. */
const isBasemapFailure = (err: Error | undefined) =>
  !!err && /openfreemap|Failed to fetch|AJAXError|NetworkError/i.test(`${err.name} ${err.message}`)

type Props = {
  data: SeedData
  selectedCollegeId: string | null
  onSelectCollege: (id: string | null) => void
}

/**
 * Live map (SPEC §6.3). Phase 2: basemap, city AQI circles, college markers, popup, legend.
 * Data changes update sources in place; the map is never remounted.
 */
export function MapView({ data, selectedCollegeId, onSelectCollege }: Props) {
  const mapRef = useRef<MapRef>(null)
  // Wide map: legend open, India shifted right of it. Narrow map: legend starts collapsed.
  const [wide] = useState(() => (document.querySelector('main')?.clientWidth ?? 0) >= WIDE_MAP_PX)
  const [mapStyle, setMapStyle] = useState<string | StyleSpecification>(OPENFREEMAP_STYLE)
  const [styleLoaded, setStyleLoaded] = useState(false)
  const [layers, setLayers] = useState<LayerVisibility>({ cityAqi: true, colleges: true })

  const aqiGeoJSON = useMemo(() => citiesToAqiGeoJSON(data.cities.data), [data.cities.data])
  const markers = useMemo(
    () => collegeMarkers(data.colleges.data, data.cities.data),
    [data.colleges.data, data.cities.data],
  )
  const selected = markers.find((m) => m.college.id === selectedCollegeId)

  const select = (id: string) => {
    onSelectCollege(id)
    const m = markers.find((x) => x.college.id === id)
    const map = mapRef.current
    if (m && map) {
      map.flyTo({
        center: [m.college.lng, m.college.lat],
        zoom: Math.max(map.getZoom(), 10),
        duration: 900,
      })
    }
  }

  return (
    <div className="relative h-full w-full">
      <MapGL
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={{
          ...INDIA_VIEW,
          fitBoundsOptions: { padding: { top: 16, bottom: 16, right: 48, left: wide ? 200 : 16 } },
        }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        onLoad={() => setStyleLoaded(true)}
        onError={(e) => {
          // Basemap failed before load → switch to the raster fallback (SPEC §5).
          if (!styleLoaded && mapStyle === OPENFREEMAP_STYLE && isBasemapFailure(e.error)) {
            console.warn('OpenFreeMap failed, using OSM raster fallback:', e.error?.message)
            setMapStyle(FALLBACK_STYLE)
          } else {
            console.error('Map error:', e.error)
          }
        }}
        onClick={() => onSelectCollege(null)}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-right" />
        {/* The OpenFreeMap / CARTO styles carry the © OpenStreetMap + tile attribution. */}
        <AttributionControl position="bottom-right" compact />

        <Source id="city-aqi" type="geojson" data={aqiGeoJSON}>
          <Layer
            id="city-aqi-circle"
            type="circle"
            layout={{ visibility: layers.cityAqi ? 'visible' : 'none' }}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.3,
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 16, 6, 36, 10, 110],
            }}
          />
          <Layer
            id="city-aqi-label"
            type="symbol"
            layout={{
              visibility: layers.cityAqi ? 'visible' : 'none',
              'text-field': ['get', 'label'],
              'text-font': LABEL_FONT,
              'text-size': 11,
              'text-anchor': 'top',
              'text-offset': [0, 1.6],
              'text-optional': true,
            }}
            paint={{
              'text-color': '#1f2937',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            }}
          />
        </Source>

        {layers.colleges &&
          markers.map((m) => (
            <CollegeMarker
              key={m.college.id}
              model={m}
              selected={m.college.id === selectedCollegeId}
              onSelect={select}
            />
          ))}

        {selected && layers.colleges && (
          <Popup
            longitude={selected.college.lng}
            latitude={selected.college.lat}
            offset={selected.sizePx / 2 + 6}
            maxWidth="320px"
            closeOnClick={false}
            onClose={() => onSelectCollege(null)}
            focusAfterOpen={false}
          >
            <CollegeCard model={selected} />
          </Popup>
        )}
      </MapGL>
      <Legend layers={layers} onChange={setLayers} defaultOpen={wide} />
    </div>
  )
}
