/**
 * Karte als Webseite (MapLibre GL JS) für die WebView.
 *
 * Warum WebView: Die native MapLibre-Bibliothek läuft nicht in Expo Go (siehe docs/SPEC-APP.md, Annahmen).
 * Kacheln und Stil kommen von OpenFreeMap, ohne API-Key. Die Seite spricht per postMessage mit der App.
 */
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
  /** Nadel (Markenfarbe). */
  pin: string;
  /** Nadel des gerade gezeigten Angebots. */
  pinActive: string;
  /** Punkt in der Nadel. */
  pinDot: string;
  user: string;
  background: string;
}

/** Freiraum am Kartenrand (Suchleiste oben, Kachel unten), damit die Nadel sichtbar mittig landet. */
export interface MapPadding {
  top: number;
  bottom: number;
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
  properties: { key: string; count: number };
}

/** Standorte als GeoJSON für die Nadeln (eine Nadel pro Adresse, keine Gruppen). */
export function placesToGeoJson(places: readonly OfferPlace[]): {
  type: 'FeatureCollection';
  features: PlaceFeature[];
} {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
      properties: { key: place.key, count: place.offers.length },
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

/**
 * Befehl für die WebView: Nadel hervorheben und die Karte so verschieben, dass sie
 * zwischen Suchleiste und Kachel sichtbar ist. `null` hebt die Auswahl auf.
 */
export function selectPlaceScript(key: string | null, padding: MapPadding): string {
  return `window.selectPlace && window.selectPlace(${toScriptJson(key)}, ${toScriptJson(padding)}); true;`;
}

/**
 * Farben für die Karte (Grün für Parks, Blau für Wasser …), angelehnt an die Klarheit von
 * Karten-Apps, aber mit eigenen Tönen. Bewusst hier und nicht in @repo/shared: Sie gelten nur
 * für den Kartenstil, nicht für Komponenten. Wird auf den OpenFreeMap-Stil „Positron“
 * angewendet; fehlt eine Ebene (anderer Stil), wird sie einfach übersprungen.
 */
export const MAP_PALETTE = {
  land: '#F6F4EF',
  residential: '#F1EFE9',
  building: '#E9E6E0',
  buildingOutline: '#DDD9D2',
  park: '#CFE8C3',
  wood: '#BFDFB0',
  grass: '#D9EECF',
  cemetery: '#D4E4CB',
  sport: '#C8E6BC',
  hospital: '#F8EAEB',
  education: '#F3EAD5',
  water: '#A8D4F2',
  waterLabel: '#2F6EA6',
  roadMajor: '#FFFFFF',
  roadMajorCasing: '#E3DED5',
  motorway: '#FBE3A0',
  motorwayCasing: '#E9C46A',
  rail: '#C9CCD2',
} as const;

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
    palette: MAP_PALETTE,
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
    // Weit raus bis ganz Europa (der Kartenstil hat ab Zoom 0 Daten).
    minZoom: 3,
    maxZoom: 18,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false
  });
  map.touchZoomRotate.disableRotation();

  var pending = null;
  var loaded = false;
  var empty = { type: 'FeatureCollection', features: [] };
  var current = empty;
  var selectedKey = null;

  // Ausgewählte Nadel: dunkler, etwas größer und immer obenauf.
  function applySelection() {
    if (!loaded) return;
    var isSelected = ['==', ['get', 'key'], selectedKey || ''];
    map.setLayoutProperty('pins', 'icon-image', ['case', isSelected, 'unfair-pin-active', 'unfair-pin']);
    map.setLayoutProperty('pins', 'icon-size', ['case', isSelected, 1.2, 1]);
    map.setLayoutProperty('pins', 'symbol-sort-key', ['case', isSelected, 1, 0]);
  }

  window.setPlaces = function (geojson) {
    current = geojson;
    if (!loaded) { pending = geojson; return; }
    map.getSource('places').setData(geojson);
  };

  window.selectPlace = function (key, padding) {
    selectedKey = key;
    applySelection();
    if (!key) return;
    var feature = current.features.find(function (f) { return f.properties.key === key; });
    if (!feature) return;
    map.easeTo({
      center: feature.geometry.coordinates,
      zoom: Math.max(map.getZoom(), 13.5),
      padding: { top: padding.top, bottom: padding.bottom, left: 24, right: 24 },
      duration: 280
    });
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

  // Kartennadel (Tropfenform mit weißem Rand und Punkt), gezeichnet statt als Bilddatei.
  // Maße in Punkten; gezeichnet in dreifacher Auflösung, damit sie scharf bleibt.
  function makePin(fill) {
    var ratio = 3, w = 34, h = 46, cx = 17, cy = 16, r = 13, tip = 42;
    var canvas = document.createElement('canvas');
    canvas.width = w * ratio; canvas.height = h * ratio;
    var ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    var beta = Math.acos(r / (tip - cy));
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI / 2 + beta, Math.PI / 2 - beta + Math.PI * 2, false);
    ctx.lineTo(cx, tip);
    ctx.closePath();
    ctx.shadowColor = 'rgba(10, 10, 10, 0.3)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    ctx.fillStyle = fill; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = config.colors.pinDot; ctx.fill();
    return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), ratio: ratio };
  }

  // Farben statt Grautönen: Parks grün, Wasser blau, große Straßen gelblich.
  // Jede Änderung einzeln abgesichert, damit ein anderer Stil die Karte nicht zerbricht.
  function paint(id, prop, value) {
    if (!map.getLayer(id)) return;
    try { map.setPaintProperty(id, prop, value); } catch (e) {}
  }
  function addFill(id, sourceLayer, classes, color, minzoom) {
    if (map.getLayer(id) || !map.getSource('openmaptiles')) return;
    try {
      map.addLayer({
        id: id, type: 'fill', source: 'openmaptiles', 'source-layer': sourceLayer, minzoom: minzoom,
        filter: ['match', ['get', 'class'], classes, true, false],
        paint: { 'fill-color': color, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], minzoom, 0, minzoom + 1, 1] }
      }, map.getLayer('park') ? 'park' : undefined);
    } catch (e) {}
  }
  function colorize() {
    var p = config.palette;
    paint('background', 'background-color', p.land);
    paint('landuse_residential', 'fill-color', p.residential);
    addFill('unfair-grass', 'landcover', ['grass', 'farmland', 'wetland'], p.grass, 10);
    addFill('unfair-cemetery', 'landuse', ['cemetery'], p.cemetery, 11);
    addFill('unfair-sport', 'landuse', ['stadium', 'pitch', 'playground'], p.sport, 12);
    addFill('unfair-hospital', 'landuse', ['hospital'], p.hospital, 12);
    addFill('unfair-education', 'landuse', ['school', 'university', 'college', 'kindergarten'], p.education, 12);
    paint('park', 'fill-color', p.park);
    paint('landcover_wood', 'fill-color', p.wood);
    paint('water', 'fill-color', p.water);
    paint('waterway', 'line-color', p.water);
    paint('building', 'fill-color', p.building);
    paint('building', 'fill-outline-color', p.buildingOutline);
    paint('road_area_pier', 'fill-color', p.land);
    paint('road_pier', 'line-color', p.land);
    paint('highway_major_casing', 'line-color', p.roadMajorCasing);
    paint('highway_major_inner', 'line-color', p.roadMajor);
    ['highway_motorway_casing', 'highway_motorway_bridge_casing'].forEach(function (id) { paint(id, 'line-color', p.motorwayCasing); });
    ['highway_motorway_inner', 'highway_motorway_bridge_inner'].forEach(function (id) { paint(id, 'line-color', p.motorway); });
    ['railway', 'railway_transit', 'railway_service'].forEach(function (id) { paint(id, 'line-color', p.rail); });
    ['water_name_point_label', 'water_name_line_label', 'waterway_line_label'].forEach(function (id) { paint(id, 'text-color', p.waterLabel); });
  }

  map.on('load', function () {
    colorize();
    var pin = makePin(config.colors.pin);
    var pinActive = makePin(config.colors.pinActive);
    map.addImage('unfair-pin', pin.image, { pixelRatio: pin.ratio });
    map.addImage('unfair-pin-active', pinActive.image, { pixelRatio: pinActive.ratio });

    // Jede Adresse bekommt eine eigene Nadel, auch wenn sie nah beieinanderliegen (keine Gruppen).
    map.addSource('places', { type: 'geojson', data: pending || empty });

    // Nadelspitze sitzt genau auf der Adresse.
    map.addLayer({ id: 'pins', type: 'symbol', source: 'places', layout: {
      'icon-image': 'unfair-pin', 'icon-anchor': 'bottom',
      'icon-allow-overlap': true, 'icon-ignore-placement': true } });

    // Die Auswahl übernimmt die App (Kachel unten). Die Karte meldet nur den Tipp.
    map.on('click', 'pins', function (event) {
      var feature = event.features && event.features[0];
      if (feature) send({ type: 'place', key: feature.properties.key });
    });
    map.on('click', function (event) {
      var hits = map.queryRenderedFeatures(event.point, { layers: ['pins'] });
      if (hits.length === 0) send({ type: 'dismiss' });
    });

    loaded = true;
    pending = null;
    applySelection();
    send({ type: 'ready' });
  });
})();
</script>
</body>
</html>`;
}
