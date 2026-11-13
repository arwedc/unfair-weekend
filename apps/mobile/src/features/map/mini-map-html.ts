/**
 * Kleine, feste Kartenvorschau (ein Pin) für die Location-Kachel auf der Detailseite.
 * Nicht verschiebbar; ein Tipp darauf öffnet in der App die Karten-App.
 * Nutzt dieselbe MapLibre-Version und Quellenangabe wie die große Karte.
 */
import { MAP_ATTRIBUTION, MAPLIBRE_CDNS, toScriptJson } from './map-html';

export const MINI_MAP_ZOOM = 14.5;

export interface MiniMapOptions {
  styleUrl: string;
  lat: number;
  lng: number;
  pinColor: string;
  background: string;
}

export function buildMiniMapHtml(options: MiniMapOptions): string {
  const config = toScriptJson({
    styleUrl: options.styleUrl,
    center: [options.lng, options.lat],
    zoom: MINI_MAP_ZOOM,
    pinColor: options.pinColor,
  });
  const [cdn, fallbackCdn] = MAPLIBRE_CDNS;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${cdn}/maplibre-gl.css" onerror="this.onerror=null;this.href='${fallbackCdn}/maplibre-gl.css'">
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
  body { background: ${options.background}; }
  #attribution {
    position: absolute; left: 0; bottom: 0; z-index: 2; padding: 1px 5px;
    font: 9px/1.4 -apple-system, Roboto, sans-serif; color: #333;
    background: rgba(255, 255, 255, 0.85); border-top-right-radius: 6px;
  }
  .pin {
    width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
    border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3);
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="attribution">${MAP_ATTRIBUTION}</div>
<script src="${cdn}/maplibre-gl.js"></script>
<script>
  if (!window.maplibregl) document.write('<script src="${fallbackCdn}/maplibre-gl.js"><\\/script>');
</script>
<script>
(function () {
  var config = ${config};
  if (!window.maplibregl) return;
  var map = new maplibregl.Map({
    container: 'map',
    style: config.styleUrl,
    center: config.center,
    zoom: config.zoom,
    interactive: false,
    attributionControl: false
  });
  var pin = document.createElement('div');
  pin.className = 'pin';
  pin.style.background = config.pinColor;
  new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat(config.center).addTo(map);
})();
</script>
</body>
</html>`;
}
