/**
 * Karte als Webseite (MapLibre GL JS) für die WebView.
 *
 * Warum WebView: Die native MapLibre-Bibliothek läuft nicht in Expo Go (siehe docs/SPEC-APP.md, Annahmen).
 * Kacheln und Stil kommen von OpenFreeMap, ohne API-Key. Die Seite spricht per postMessage mit der App.
 */
import type { OfferCategory } from '@repo/shared';

import type { OfferPlace } from '../offers/feed-logic';

import type { CitySummary } from './map-logic';
import { PIN_ICON_PATHS, placeCategory } from './pin-icons';

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
  /** Kategorie-Symbol in der Nadel. */
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
  /** Die Karte ist am eigenen Standort angekommen (Ladesymbol im Knopf ausblenden). */
  | { type: 'userShown' }
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
      case 'userShown':
        return { type: value.type };
      case 'place':
        return typeof value.key === 'string' ? { type: 'place', key: value.key } : null;
      case 'link':
        return typeof value.url === 'string' ? { type: 'link', url: value.url } : null;
      case 'error':
        return {
          type: 'error',
          message: typeof value.message === 'string' ? value.message : '',
        };
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
  properties: { key: string; count: number; category: OfferCategory };
}

/** Standorte als GeoJSON für die Nadeln (eine Nadel pro Adresse, keine Gruppen, Symbol nach Kategorie). */
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
        count: place.offers.length,
        category: placeCategory(place),
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
/**
 * Bis zu dieser Zoomstufe (weite Ansicht, z. B. Europa) zeigt die Karte eine Nadel pro
 * Stadt statt der einzelnen Angebote. Ein Tipp darauf zoomt in die Stadt.
 */
export const CITY_PIN_MAX_ZOOM = 8;

/** Befehl für die WebView: Sammelnadeln der Städte ersetzen. */
export function setCitiesScript(cities: readonly CitySummary[]): string {
  const geojson = {
    type: 'FeatureCollection',
    features: cities.map((city) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [city.lng, city.lat] },
      properties: { id: city.id, name: city.name },
    })),
  };
  return `window.setCities && window.setCities(${toScriptJson(geojson)}); true;`;
}

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
  /** Gewählte Nadel: sanftes Koralle, heller als die normale Nadel, aber nicht grell. */
  pinSelected: '#F57C64',
  /** Eigener Standort: Blau wie in Karten-Apps üblich, klar getrennt von den orangen Nadeln. */
  userLocation: '#2F7FF0',
} as const;

/** Befehl für die WebView: ohne Animation auf eine Stadt springen (Zoom wie beim Start). */
export function setCenterScript(lat: number, lng: number): string {
  return `window.setCenter && window.setCenter(${toScriptJson([lng, lat])}); true;`;
}

/**
 * Befehl für die WebView: eigenen Standort zeigen. `move: false` setzt nur den Punkt neu
 * (genauere Ortung kam nach), ohne die Karte zu bewegen.
 */
export function showUserScript(lat: number, lng: number, move = true): string {
  return `window.showUser && window.showUser(${toScriptJson([lng, lat])}, ${move}); true;`;
}

export function buildMapHtml(options: { styleUrl: string; colors: MapColors }): string {
  const config = toScriptJson({
    styleUrl: options.styleUrl,
    center: [MUENSTER_CENTER.lng, MUENSTER_CENTER.lat],
    zoom: DEFAULT_ZOOM,
    cityPinMaxZoom: CITY_PIN_MAX_ZOOM,
    colors: options.colors,
    palette: MAP_PALETTE,
    icons: PIN_ICON_PATHS,
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

  // Bildname der Nadel: pin-<kategorie>, für die gewählte pin-<kategorie>-active.
  var pinImage = ['concat', 'pin-', ['get', 'category']];

  // Ausgewählte Nadel: heller Markenton, etwas größer und immer obenauf.
  function applySelection() {
    if (!loaded) return;
    var isSelected = ['==', ['get', 'key'], selectedKey || ''];
    map.setLayoutProperty('pins', 'icon-image', ['case', isSelected, ['concat', pinImage, '-active'], pinImage]);
    map.setLayoutProperty('pins', 'icon-size', ['case', isSelected, 1.15, 1]);
    map.setLayoutProperty('pins', 'symbol-sort-key', ['case', isSelected, 1, 0]);
  }

  var pendingCities = null;
  window.setCities = function (geojson) {
    if (!loaded) { pendingCities = geojson; return; }
    map.getSource('cities').setData(geojson);
  };

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
  window.showUser = function (lngLat, move) {
    if (!userMarker) {
      var dot = document.createElement('div');
      dot.style.cssText = 'width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);background:' + config.colors.user;
      userMarker = new maplibregl.Marker({ element: dot }).setLngLat(lngLat).addTo(map);
    } else {
      userMarker.setLngLat(lngLat);
    }
    if (move === false) return;
    // Weit weg (andere Stadt): springen statt lange fliegen. In der Nähe: kurze Fahrt.
    var far = map.getCenter().distanceTo(maplibregl.LngLat.convert(lngLat)) > 20000;
    var target = { center: lngLat, zoom: Math.max(map.getZoom(), 14) };
    // Melden, sobald die Karte steht (und die Kacheln dort gezeichnet sind), damit die App das
    // Ladesymbol genau dann ausblendet.
    map.once('idle', function () { send({ type: 'userShown' }); });
    if (far) map.jumpTo(target); else map.easeTo(Object.assign(target, { duration: 300 }));
  };

  window.setCenter = function (lngLat) {
    map.jumpTo({ center: lngLat, zoom: config.zoom });
  };

  map.on('error', function (event) {
    if (!loaded) send({ type: 'error', message: event && event.error ? String(event.error.message) : '' });
  });

  // Kartennadel (Tropfenform mit weißem Rand) mit dem Symbol der Kategorie im Kopf,
  // gezeichnet statt als Bilddatei. Maße in Punkten, dreifache Auflösung für scharfe Kanten.
  function makePin(fill, iconPaths) {
    var ratio = 3, w = 32, h = 42, cx = 16, cy = 15, r = 12.5, tip = 39, icon = 14;
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
    // Symbol: Lucide-Pfade im 24er-Raster, mittig in den Kopf skaliert.
    ctx.save();
    ctx.translate(cx - icon / 2, cy - icon / 2);
    ctx.scale(icon / 24, icon / 24);
    ctx.lineWidth = 2.25; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = config.colors.pinDot;
    (iconPaths || []).forEach(function (d) {
      try { ctx.stroke(new Path2D(d)); } catch (e) {}
    });
    ctx.restore();
    return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), ratio: ratio };
  }

  // Nadel für eine ganze Stadt (weite Ansicht): etwas größer, mit weißem Punkt statt Symbol.
  function makeCityPin(fill) {
    var ratio = 3, w = 44, h = 56, cx = 22, cy = 20, r = 17.5, tip = 52;
    var canvas = document.createElement('canvas');
    canvas.width = w * ratio; canvas.height = h * ratio;
    var ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    var beta = Math.acos(r / (tip - cy));
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI / 2 + beta, Math.PI / 2 - beta + Math.PI * 2, false);
    ctx.lineTo(cx, tip);
    ctx.closePath();
    ctx.shadowColor = 'rgba(10, 10, 10, 0.3)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
    ctx.fillStyle = fill; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
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
    // Pro Kategorie zwei Nadeln: normal und gewählt.
    Object.keys(config.icons).forEach(function (category) {
      var pin = makePin(config.colors.pin, config.icons[category]);
      var pinActive = makePin(config.colors.pinActive, config.icons[category]);
      map.addImage('pin-' + category, pin.image, { pixelRatio: pin.ratio });
      map.addImage('pin-' + category + '-active', pinActive.image, { pixelRatio: pinActive.ratio });
    });

    // Jede Adresse bekommt eine eigene Nadel, auch wenn sie nah beieinanderliegen (keine Gruppen).
    map.addSource('places', { type: 'geojson', data: pending || empty });

    // Nadelspitze sitzt genau auf der Adresse.
    map.addLayer({ id: 'pins', type: 'symbol', source: 'places', minzoom: config.cityPinMaxZoom, layout: {
      'icon-image': pinImage, 'icon-anchor': 'bottom',
      'icon-allow-overlap': true, 'icon-ignore-placement': true } });

    // Weite Ansicht: eine schlichte Nadel pro Stadt (ohne Zahl).
    var cityPin = makeCityPin(config.colors.pin);
    map.addImage('pin-city', cityPin.image, { pixelRatio: cityPin.ratio });
    map.addSource('cities', { type: 'geojson', data: pendingCities || empty });
    map.addLayer({ id: 'city-pins', type: 'symbol', source: 'cities', maxzoom: config.cityPinMaxZoom, layout: {
      'icon-image': 'pin-city', 'icon-anchor': 'bottom',
      'icon-allow-overlap': true, 'icon-ignore-placement': true } });

    // Tipp auf eine Stadt: hineinzoomen, dann erscheinen die einzelnen Angebote.
    map.on('click', 'city-pins', function (event) {
      var feature = event.features && event.features[0];
      if (!feature) return;
      send({ type: 'dismiss' });
      map.flyTo({ center: feature.geometry.coordinates, zoom: config.zoom, duration: 1200, essential: true });
    });

    // Die Auswahl übernimmt die App (Kachel unten). Die Karte meldet nur den Tipp.
    map.on('click', 'pins', function (event) {
      var feature = event.features && event.features[0];
      if (feature) send({ type: 'place', key: feature.properties.key });
    });
    map.on('click', function (event) {
      var hits = map.queryRenderedFeatures(event.point, { layers: ['pins', 'city-pins'] });
      if (hits.length === 0) send({ type: 'dismiss' });
    });

    loaded = true;
    pending = null;
    pendingCities = null;
    applySelection();
    send({ type: 'ready' });
  });
})();
</script>
</body>
</html>`;
}
