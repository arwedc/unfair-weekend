import { describe, expect, it } from 'vitest';

import type { OfferPlace } from '@/features/offers/feed-logic';

import {
  buildMapHtml,
  MAP_ATTRIBUTION,
  MAPLIBRE_CDNS,
  parseMapMessage,
  placesToGeoJson,
  setCenterScript,
  setPlacesScript,
  toScriptJson,
} from './map-html';

const colors = {
  pin: '#111111',
  pinText: '#ffffff',
  cluster: '#222222',
  clusterText: '#ffffff',
  user: '#333333',
  background: '#ffffff',
};

const place = (overrides: Partial<OfferPlace> = {}): OfferPlace => ({
  key: '51.96000,7.62000',
  lat: 51.96,
  lng: 7.62,
  offers: [],
  maxDiscount: 40,
  ...overrides,
});

describe('placesToGeoJson', () => {
  it('setzt Koordinaten als [lng, lat] und den Rabatt als Beschriftung', () => {
    const geojson = placesToGeoJson([place()]);
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]?.geometry.coordinates).toEqual([7.62, 51.96]);
    expect(geojson.features[0]?.properties.key).toBe('51.96000,7.62000');
    expect(geojson.features[0]?.properties.label).toContain('40');
  });

  it('liefert ohne Standorte eine leere Sammlung', () => {
    expect(placesToGeoJson([]).features).toEqual([]);
  });
});

describe('toScriptJson', () => {
  it('entschärft schließende Script-Tags', () => {
    expect(toScriptJson({ text: '</script>' })).not.toContain('</script>');
  });
});

describe('setPlacesScript', () => {
  it('ruft setPlaces auf und endet mit true', () => {
    const script = setPlacesScript([place()]);
    expect(script).toContain('window.setPlaces(');
    expect(script.trim().endsWith('true;')).toBe(true);
  });
});

describe('setCenterScript', () => {
  it('springt mit [lng, lat] auf die Stadt', () => {
    const script = setCenterScript(54.6872, 25.2797);
    expect(script).toContain('window.setCenter([25.2797,54.6872])');
    expect(script.trim().endsWith('true;')).toBe(true);
  });
});

describe('buildMapHtml', () => {
  const html = buildMapHtml({ styleUrl: 'https://tiles.openfreemap.org/styles/positron', colors });

  it('enthält die Stil-URL und die Pflicht-Quellenangabe', () => {
    expect(html).toContain('https://tiles.openfreemap.org/styles/positron');
    expect(html).toContain(MAP_ATTRIBUTION);
  });

  it('zeigt die Quellenangabe als feste Zeile statt der automatischen (doppelten)', () => {
    expect(html).toContain('id="attribution"');
    expect(html).toContain('attributionControl: false');
    expect(html).toContain('https://www.openstreetmap.org/copyright');
  });

  it('lädt MapLibre als klassisches Skript (5er-Reihe) von zwei CDNs', () => {
    // Ab Version 6 gibt es keine dist/maplibre-gl.js mehr, die Karte bliebe leer.
    expect(MAPLIBRE_CDNS).toHaveLength(2);
    for (const cdn of MAPLIBRE_CDNS) {
      expect(cdn).toMatch(/maplibre-gl@5\.\d+\.\d+\/dist$/);
      expect(html).toContain(`${cdn}/maplibre-gl.js`);
    }
  });
});

describe('parseMapMessage', () => {
  it('liest bekannte Nachrichten', () => {
    expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseMapMessage('{"type":"place","key":"a"}')).toEqual({ type: 'place', key: 'a' });
    expect(parseMapMessage('{"type":"link","url":"https://x.de"}')).toEqual({
      type: 'link',
      url: 'https://x.de',
    });
  });

  it('verwirft Unbekanntes und kaputtes JSON', () => {
    expect(parseMapMessage('{"type":"place"}')).toBeNull();
    expect(parseMapMessage('{"type":"boom"}')).toBeNull();
    expect(parseMapMessage('kein json')).toBeNull();
  });
});
