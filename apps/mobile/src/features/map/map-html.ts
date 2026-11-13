/**
 * Karte als Webseite (MapLibre GL JS) für die WebView.
 *
 * Warum WebView: Die native MapLibre-Bibliothek läuft nicht in Expo Go (siehe docs/SPEC-APP.md, Annahmen).
 * Kacheln und Stil kommen von OpenFreeMap, ohne API-Key. Die Seite spricht per postMessage mit der App.
 */
import { formatDiscount } from '@repo/shared';

import type { OfferPlace } from '@/features/offers/feed-logic';

/**
 * MapLibre GL JS aus der 5er-Reihe (wird weiter gepflegt, npm-Tag `latest-5`).
 * Nicht auf 6 anheben: Ab Version 6 gibt es nur noch ES-Module (`.mjs`) und keine
 * `dist/maplibre-gl.js` mehr, die sich per <script> in die WebView laden lässt.
 */
const MAPLIBRE_VERSION = '5.24.1';

/** Zwei CDNs: Fällt das erste aus, lädt die Seite die Bibliothek vom zweiten. */
export const MAPLIBRE_CDNS = [
  `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist`,
  `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist`,
] as const;

/** Rathaus Münster als Kartenmitte. */
export const MUENSTER_CENTER = { lat: 51.9607, lng: 7.6261 } as const;
export const DEFAULT_ZOOM = 12.2;

/** Pflichtangabe von OpenFreeMap. Steht zusätzlich fest in der Karte. */
export const MAP_ATTRIBUTION = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap';

export interface MapColors {
  pin: string;
  pinText: string;
  cluster: string;
  clusterText: string;
  user: string;
  background: string;
}

/** Nachrichten der Karte an die App. */
export type MapMessage =
  | { type: 'ready' }
  | { type: 'place'; key: string }
  | { type: 'dismiss' }
  | { type: 'link'; url: string }
  | { type: 'error'; message: string };

export function parseMapMessage(raw: string): MapMessage | null {
  try {
    const value = JSON.parse(raw) as {
      type?: unknown;
      key?: unknown;
      url?: unknown;
      message?: unknown;
    };
    switch (value.type) {
      case 'ready':
      case 'dismiss':
        return { type: value.type };
      case 'place':
        return typeof value.key === 'string' ? { type: 'place', key: value.key } : null;
      case 'link':
        return typeof value.url === 'string' ? { type: 'link', url: value.url } : null;
      case 'error':
        return { type: 'error', message: typeof value.message === 'string' ? value.message : '' };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

interface PlaceFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { key: string; label: string; count: number };
}

/** Standorte als GeoJSON für die Pins. Im Pin steht der höchste Rabatt am Ort. */
export function placesToGeoJson(places: readonly OfferPlace[]): {
  type: 'FeatureCollection';
  features: PlaceFeature[];
} {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
      properties: {
        key: place.key,
        label: formatDiscount(place.maxDiscount),
        count: place.offers.length,
      },
    })),
  };
}

/** Zeilentrenner U+2028/U+2029 beenden in JavaScript eine Zeile und würden das Skript zerbrechen. */
const LINE_SEPARATORS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

/** JSON so einbetten, dass es in einem <script> oder injectJavaScript sicher ist. */
export function toScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(LINE_SEPARATORS, '');
}

/** Befehl für die WebView: Pins ersetzen. */
export function setPlacesScript(places: readonly OfferPlace[]): string {
  return `window.setPlaces && window.setPlaces(${toScriptJson(placesToGeoJson(places))}); true;`;
}

/** Befehl für die WebView: eigenen Standort zeigen und hinfliegen. */
export function showUserScript(lat: number, lng: number): string {
  return `window.showUser && window.showUser(${toScriptJson([lng, lat])}); true;`;
}

export function buildMapHtml(options: { styleUrl: string; colors: MapColors }): string {
  const config = toScriptJson({
    styleUrl: options.styleUrl,
    center: [MUENSTER_CENTER.lng, MUENSTER_CENTER.lat],
    zoom: DEFAULT_ZOOM,
    colors: options.colors,
  });
  const [cdn, fallbackCdn] = MAPLIBRE_CDNS;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${cdn}/maplibre-gl.css" onerror="this.onerror=null;this.href='${fallbackCdn}/maplibre-gl.css'">
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
  body { background: ${options.colors.background}; -webkit-tap-highlight-color: transparent; }
  #attribution {
    position: absolute; left: 0; bottom: 0; z-index: 2; padding: 2px 6px;
    font: 10px/1.4 -apple-system, Roboto, sans-serif; color: #333;
    background: rgba(255, 255, 255, 0.85); border-top-right-radius: 6px;
  }
  #attribution a { color: inherit; text-decoration: none; }
</style>
</head>
<body>
<div id="map"></div>
<!-- Pflicht-Quellenangabe, fest sichtbar (der Stil bringt sie doppelt mit, deshalb eigene Zeile). -->
<div id="attribution" aria-label="${MAP_ATTRIBUTION}"><a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></div>
<script src="${cdn}/maplibre-gl.js"></script>
<script>
  // Erstes CDN nicht erreichbar: synchron vom zweiten nachladen, bevor die Karte startet.
  if (!window.maplibregl) document.write('<script src="${fallbackCdn}/maplibre-gl.js"><\\/script>');
</script>
<script>
(function () {
  var config = ${config};
  function send(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  window.onerror = function (message) { send({ type: 'error', message: String(message) }); };
  if (!window.maplibregl) { send({ type: 'error', message: 'Karte konnte nicht geladen werden.' }); return; }

  // Links (Quellenangabe) öffnet die App im Browser, nicht in der Karte.
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a') : null;
    if (link && link.href) { event.preventDefault(); send({ type: 'link', url: link.href }); }
  }, true);

  var map = new maplibregl.Map({
    container: 'map',
    style: config.styleUrl,
    center: config.center,
    zoom: config.zoom,
    minZoom: 9,
    maxZoom: 18,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false
  });
  map.touchZoomRotate.disableRotation();

  var pending = null;
  var loaded = false;
  var empty = { type: 'FeatureCollection', features: [] };

  window.setPlaces = function (geojson) {
    if (!loaded) { pending = geojson; return; }
    map.getSource('places').setData(geojson);
  };

  var userMarker = null;
  window.showUser = function (lngLat) {
    if (!userMarker) {
      var dot = document.createElement('div');
      dot.style.cssText = 'width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);background:' + config.colors.user;
      userMarker = new maplibregl.Marker({ element: dot }).setLngLat(lngLat).addTo(map);
    } else {
      userMarker.setLngLat(lngLat);
    }
    map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14) });
  };

  map.on('error', function (event) {
    if (!loaded) send({ type: 'error', message: event && event.error ? String(event.error.message) : '' });
  });

  map.on('load', function () {
    map.addSource('places', { type: 'geojson', data: pending || empty, cluster: true, clusterRadius: 44, clusterMaxZoom: 15 });

    map.addLayer({ id: 'clusters', type: 'circle', source: 'places', filter: ['has', 'point_count'], paint: {
      'circle-color': config.colors.cluster, 'circle-radius': ['step', ['get', 'point_count'], 20, 5, 24, 15, 28],
      'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
    map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'places', filter: ['has', 'point_count'], layout: {
      'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-allow-overlap': true },
      paint: { 'text-color': config.colors.clusterText } });

    map.addLayer({ id: 'pins', type: 'circle', source: 'places', filter: ['!', ['has', 'point_count']], paint: {
      'circle-color': config.colors.pin, 'circle-radius': 22, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } });
    map.addLayer({ id: 'pin-labels', type: 'symbol', source: 'places', filter: ['!', ['has', 'point_count']], layout: {
      'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': config.colors.pinText } });

    map.on('click', 'clusters', function (event) {
      var feature = event.features && event.features[0];
      if (!feature) return;
      map.getSource('places').getClusterExpansionZoom(feature.properties.cluster_id).then(function (zoom) {
        map.easeTo({ center: feature.geometry.coordinates, zoom: zoom });
      });
    });
    map.on('click', 'pins', function (event) {
      var feature = event.features && event.features[0];
      if (!feature) return;
      map.easeTo({ center: feature.geometry.coordinates });
      send({ type: 'place', key: feature.properties.key });
    });
    map.on('click', function (event) {
      var hits = map.queryRenderedFeatures(event.point, { layers: ['pins', 'clusters'] });
      if (hits.length === 0) send({ type: 'dismiss' });
    });

    loaded = true;
    pending = null;
    send({ type: 'ready' });
  });
})();
</script>
</body>
</html>`;
}
