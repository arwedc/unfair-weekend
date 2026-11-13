import { describe, expect, it } from 'vitest';

import { MAP_ATTRIBUTION } from './map-html';
import { buildMiniMapHtml } from './mini-map-html';

describe('buildMiniMapHtml', () => {
  const html = buildMiniMapHtml({
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    lat: 51.9625,
    lng: 7.628,
    pinColor: '#D63A0A',
    background: '#F5F5F5',
  });

  it('zentriert auf den Ort und zeigt die Pflicht-Quellenangabe', () => {
    expect(html).toContain('"center":[7.628,51.9625]');
    expect(html).toContain(MAP_ATTRIBUTION);
  });

  it('ist nicht verschiebbar', () => {
    expect(html).toContain('interactive: false');
  });
});
