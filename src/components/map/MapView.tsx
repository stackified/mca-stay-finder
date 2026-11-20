import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, {
  AttributionControl,
  Layer,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, StyleSpecification } from 'maplibre-gl'
// MapLibre 6 finds its worker relative to its own module, which breaks after Vite bundles it.
// The worker file has no imports, so serving it as a plain asset works in dev and build.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import {
  citiesToAqiGeoJSON,
  localitiesToGeoJSON,
  ringBounds,
  ringGeoJSON,
  staysToGeoJSON,
  toMarkerModels,
} from '@/lib/mapData'
import { useAppStore, type Results } from '@/store/useAppStore'
import { CollegeCard } from './CollegeCard'
import { CollegeMarker } from './CollegeMarker'
import { Legend, type LayerVisibility } from './Legend'
import { FALLBACK_STYLE, INDIA_VIEW, LABEL_FONT, OPENFREEMAP_STYLE } from './mapStyle'
import { StayCard } from './StayCard'

// Set it on the same instance that the map uses (passed below as `mapLib`).
maplibregl.setWorkerUrl(maplibreWorkerUrl)

const WIDE_MAP_PX = 720
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] }

/** True when the error is the basemap style or its tiles failing to download. */
const isBasemapFailure = (err: Error | undefined) =>
  !!err && /openfreemap|Failed to fetch|AJAXError|NetworkError/i.test(`${err.name} ${err.message}`)

/**
 * Live map (SPEC §6.3): basemap, city AQI circles, college markers, clustered stays,
 * radius ring, localities, popups, legend.
 * Filter / weight changes update GeoJSON sources in place (setData); the map is never remounted.
 */
export function MapView({ results }: { results: Results }) {
  const mapRef = useRef<MapRef>(null)
  const data = useAppStore((s) => s.data)
  const radiusKm = useAppStore((s) => s.filters.stayMaxDistanceKm)
  const selectedCollegeId = useAppStore((s) => s.selectedCollegeId)
  const selectCollege = useAppStore((s) => s.selectCollege)
  const selectedStayId = useAppStore((s) => s.selectedStayId)
  const selectStay = useAppStore((s) => s.selectStay)
  // Wide map: legend open, India shifted right of it. Narrow map: legend starts collapsed.
  const [wide] = useState(() => (document.querySelector('main')?.clientWidth ?? 0) >= WIDE_MAP_PX)
  const [mapStyle, setMapStyle] = useState<string | StyleSpecification>(OPENFREEMAP_STYLE)
  const [styleLoaded, setStyleLoaded] = useState(false)
  const [layers, setLayers] = useState<LayerVisibility>({
    cityAqi: true,
    colleges: true,
    stays: true,
    localities: true,
  })

  const aqiGeoJSON = useMemo(
    () => citiesToAqiGeoJSON(results.visibleCities),
    [results.visibleCities],
  )
  const markers = useMemo(() => toMarkerModels(results.rows), [results.rows])
  const selected = markers.find((m) => m.college.id === selectedCollegeId)
  const staysGeoJSON = useMemo(() => staysToGeoJSON(results.stays), [results.stays])
  const selectedStay = results.stays.find((r) => r.stay.id === selectedStayId)

  const selLng = selected?.college.lng
  const selLat = selected?.college.lat
  const ring = useMemo(
    () =>
      selLng !== undefined && selLat !== undefined
        ? ringGeoJSON({ lat: selLat, lng: selLng }, radiusKm)
        : null,
    [selLng, selLat, radiusKm],
  )
  const campusLocalities = useMemo(
    () =>
      selected && data
        ? data.localities.data.filter((l) => l.collegeId === selected.college.id)
        : [],
    [selected, data],
  )
  const localitiesGeoJSON = useMemo(() => localitiesToGeoJSON(campusLocalities), [campusLocalities])

  // On selecting a college (map or table): fit the ring in view. Changing the radius later
  // only resizes the ring; it does not move the camera.
  const radiusRef = useRef(radiusKm)
  useEffect(() => {
    radiusRef.current = radiusKm
  }, [radiusKm])
  useEffect(() => {
    const map = mapRef.current
    if (!map || selLng === undefined || selLat === undefined) return
    map.fitBounds(ringBounds({ lat: selLat, lng: selLng }, Math.max(radiusRef.current, 1)), {
      padding: 40,
      duration: 900,
      maxZoom: 15,
    })
  }, [selLng, selLat, styleLoaded])

  // Fly to a stay picked in the Stays list.
  const stayLng = selectedStay?.stay.lng
  const stayLat = selectedStay?.stay.lat
  useEffect(() => {
    const map = mapRef.current
    if (!map || stayLng === undefined || stayLat === undefined) return
    map.easeTo({ center: [stayLng, stayLat], zoom: Math.max(map.getZoom(), 14), duration: 600 })
  }, [stayLng, stayLat])

  const onMapClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) {
      selectStay(null)
      return
    }
    if (f.layer.id === 'stay-clusters') {
      const source = mapRef.current?.getSource('stays') as GeoJSONSource | undefined
      const clusterId = f.properties?.cluster_id as number | undefined
      if (source && clusterId !== undefined) {
        void source.getClusterExpansionZoom(clusterId).then((zoom) => {
          const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number]
          mapRef.current?.easeTo({ center: [lng, lat], zoom, duration: 500 })
        })
      }
      return
    }
    if (f.layer.id === 'stay-point') selectStay(String(f.properties?.id))
  }

  const stayVis = layers.stays ? 'visible' : 'none'
  const locVis = layers.localities ? 'visible' : 'none'

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
        interactiveLayerIds={layers.stays ? ['stay-clusters', 'stay-point'] : []}
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
        onClick={onMapClick}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-right" />
        {/* The OpenFreeMap / OSM styles carry the © OpenStreetMap + tile attribution. */}
        <AttributionControl position="bottom-right" compact />

        <Source id="city-aqi" type="geojson" data={aqiGeoJSON}>
          <Layer
            id="city-aqi-circle"
            type="circle"
            layout={{ visibility: layers.cityAqi ? 'visible' : 'none' }}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 11, 0.08],
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 8, 1, 11, 0.3],
              'circle-stroke-width': 2,
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 16, 6, 36, 10, 110],
            }}
          />
          <Layer
            id="city-aqi-label"
            type="symbol"
            maxzoom={10}
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

        {/* Radius ring around the selected campus (SPEC §6.3). */}
        <Source id="ring" type="geojson" data={ring ?? EMPTY_FC}>
          <Layer
            id="ring-fill"
            type="fill"
            paint={{ 'fill-color': '#2563eb', 'fill-opacity': 0.05 }}
          />
          <Layer
            id="ring-line"
            type="line"
            paint={{ 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [3, 2] }}
          />
        </Source>

        {/* Localities near the selected campus (SPEC §11.6). */}
        <Source id="localities" type="geojson" data={localitiesGeoJSON}>
          <Layer
            id="locality-dot"
            type="circle"
            layout={{ visibility: locVis }}
            paint={{
              'circle-radius': 5,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#0f172a',
              'circle-stroke-width': 2,
            }}
          />
          <Layer
            id="locality-label"
            type="symbol"
            layout={{
              visibility: locVis,
              'text-field': ['get', 'label'],
              'text-font': LABEL_FONT,
              'text-size': 11,
              'text-anchor': 'left',
              'text-offset': [0.8, 0],
              'text-optional': true,
            }}
            paint={{
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            }}
          />
        </Source>

        {/* Stays, clustered when zoomed out (SPEC §6.3). */}
        <Source
          id="stays"
          type="geojson"
          data={staysGeoJSON}
          cluster
          clusterMaxZoom={14}
          clusterRadius={40}
        >
          <Layer
            id="stay-clusters"
            type="circle"
            filter={['has', 'point_count']}
            layout={{ visibility: stayVis }}
            paint={{
              'circle-color': '#475569',
              'circle-opacity': 0.85,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-radius': ['step', ['get', 'point_count'], 12, 10, 16, 50, 22],
            }}
          />
          <Layer
            id="stay-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              visibility: stayVis,
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': LABEL_FONT,
              'text-size': 11,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="stay-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            layout={{ visibility: stayVis }}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': 8,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.5,
            }}
          />
          <Layer
            id="stay-symbol"
            type="symbol"
            filter={['!', ['has', 'point_count']]}
            layout={{
              visibility: stayVis,
              'text-field': ['get', 'symbol'],
              'text-font': LABEL_FONT,
              'text-size': 10,
              'text-allow-overlap': true,
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
        </Source>

        {layers.colleges &&
          markers.map((m) => (
            <CollegeMarker
              key={m.college.id}
              model={m}
              selected={m.college.id === selectedCollegeId}
              onSelect={selectCollege}
            />
          ))}

        {selectedStay && layers.stays && (
          <Popup
            key={selectedStay.stay.id}
            longitude={selectedStay.stay.lng}
            latitude={selectedStay.stay.lat}
            offset={12}
            maxWidth="300px"
            closeOnClick={false}
            onClose={() => selectStay(null)}
            focusAfterOpen={false}
          >
            <StayCard
              row={selectedStay}
              campus={data?.colleges.data.find((c) => c.id === selectedStay.campusId)}
              city={data?.cities.data.find(
                (c) =>
                  c.id === data.colleges.data.find((x) => x.id === selectedStay.campusId)?.cityId,
              )}
              localities={
                data?.localities.data.filter((l) => l.collegeId === selectedStay.campusId) ?? []
              }
            />
          </Popup>
        )}

        {selected && layers.colleges && !selectedStay && (
          <Popup
            longitude={selected.college.lng}
            latitude={selected.college.lat}
            offset={selected.sizePx / 2 + 6}
            maxWidth="320px"
            closeOnClick={false}
            onClose={() => selectCollege(null)}
            focusAfterOpen={false}
          >
            <CollegeCard model={selected} />
          </Popup>
        )}
      </MapGL>
      {results.matchCount === 0 && (
        <div
          role="status"
          className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-md border bg-background/95 px-3 py-1.5 text-xs shadow"
        >
          No colleges match. See the Ranked tab for which filter to relax.
        </div>
      )}
      <Legend layers={layers} onChange={setLayers} defaultOpen={wide} />
    </div>
  )
}
