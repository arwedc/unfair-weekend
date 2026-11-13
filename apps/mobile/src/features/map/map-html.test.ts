import { OFFER_CATEGORIES } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import type { OfferPlace } from '@/features/offers/feed-logic';

import {
  buildMapHtml,
  CITY_PIN_MAX_ZOOM,
  MAP_ATTRIBUTION,
  MAP_PALETTE,
  MAPLIBRE_CDNS,
  parseMapMessage,
  placesToGeoJson,
  selectPlaceScript,
  setCitiesScript,
  setCenterScript,
  setPlacesScript,
  showUserScript,
  toScriptJson,
} from './map-html';

const colors = {
  pin: '#111111',
  pinActive: '#000000',
  pinDot: '#ffffff',
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
  it('setzt Koordinaten als [lng, lat] und den Schlüssel des Orts', () => {
    const geojson = placesToGeoJson([place()]);
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]?.geometry.coordinates).toEqual([7.62, 51.96]);
    expect(geojson.features[0]?.properties.key).toBe('51.96000,7.62000');
  });

  it('zählt die Angebote pro Ort', () => {
    const offer = { free_seats: 3 } as OfferPlace['offers'][number];
    expect(placesToGeoJson([place({ offers: [offer, offer] })]).features[0]?.properties.count).toBe(
      2,
    );
  });

  it('gibt jeder Nadel die Kategorie für das Symbol mit', () => {
    const offer = { free_seats: 3, category: 'sport_bewegung' } as OfferPlace['offers'][number];
    expect(placesToGeoJson([place({ offers: [offer] })]).features[0]?.properties.category).toBe(
      'sport_bewegung',
    );
  });

  it('liefert ohne Standorte eine leere Sammlung', () => {
    expect(placesToGeoJson([]).features).toEqual([]);
  });
});

describe('Nadeln mit Kategorie-Symbol', () => {
  const html = buildMapHtml({ styleUrl: 'https://tiles.openfreemap.org/styles/positron', colors });

  it('legt pro Kategorie eine normale und eine gewählte Nadel an', () => {
    expect(html).toContain("'pin-' + category");
    expect(html).toContain("'-active'");
    expect(html).toContain('new Path2D(d)');
  });

  it('bettet die Symbol-Pfade aller Kategorien ein', () => {
    for (const category of OFFER_CATEGORIES) expect(html).toContain(`"${category}":[`);
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

describe('selectPlaceScript', () => {
  it('übergibt Schlüssel und Abstände', () => {
    const script = selectPlaceScript('a', { top: 120, bottom: 200 });
    expect(script).toContain('window.selectPlace("a", {"top":120,"bottom":200})');
    expect(selectPlaceScript(null, { top: 0, bottom: 0 })).toContain('window.selectPlace(null');
  });
});

describe('showUserScript', () => {
  it('fährt zum Standort oder setzt nur den Punkt nach', () => {
    expect(showUserScript(51.96, 7.62)).toContain('window.showUser([7.62,51.96], true)');
    expect(showUserScript(51.96, 7.62, false)).toContain('window.showUser([7.62,51.96], false)');
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

  it('färbt Parks grün und Wasser blau ein', () => {
    expect(html).toContain('colorize()');
    expect(html).toContain(MAP_PALETTE.park);
    expect(html).toContain(MAP_PALETTE.water);
    expect(html).toContain("paint('water', 'fill-color', p.water)");
  });

  it('zeichnet Nadeln statt Kreisen mit Rabatt', () => {
    expect(html).toContain("'icon-image'");
    expect(html).toContain("'icon-anchor': 'bottom'");
    expect(html).not.toContain('pin-labels');
  });

  it('fasst nah beieinanderliegende Nadeln nicht zusammen', () => {
    expect(html).not.toContain('cluster: true');
    expect(html).not.toContain("id: 'clusters'");
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

describe('setCitiesScript', () => {
  it('übergibt eine Nadel pro Stadt mit Anzahl', () => {
    const script = setCitiesScript([
      { id: 'muenster', name: 'Münster', lat: 51.96, lng: 7.62, count: 6 },
    ]);
    expect(script).toContain('window.setCities(');
    expect(script).toContain('"coordinates":[7.62,51.96]');
    expect(script).toContain('"count":6');
  });

  it('zeigt Städte nur in der weiten Ansicht, einzelne Angebote erst darunter', () => {
    const html = buildMapHtml({ styleUrl: 'https://example.org/style', colors });
    expect(html).toContain("id: 'city-pins'");
    expect(html).toContain('maxzoom: config.cityPinMaxZoom');
    expect(html).toContain("source: 'places', minzoom: config.cityPinMaxZoom");
    expect(CITY_PIN_MAX_ZOOM).toBeGreaterThan(3);
  });
});
