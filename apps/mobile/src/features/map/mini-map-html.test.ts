import { describe, expect, it } from 'vitest';

import { MAP_ATTRIBUTION } from './map-html';
import { buildMiniMapHtml, MINI_MAP_ZOOM } from './mini-map-html';

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

  it('ist nah genug für lesbare Straßen', () => {
    expect(html).toContain(`"zoom":${MINI_MAP_ZOOM}`);
    expect(MINI_MAP_ZOOM).toBeGreaterThanOrEqual(15.5);
  });

  it('setzt den Namen als Text und lässt kein HTML durch', () => {
    const labelled = buildMiniMapHtml({
      styleUrl: 'https://tiles.openfreemap.org/styles/positron',
      lat: 51.9625,
      lng: 7.628,
      pinColor: '#D63A0A',
      background: '#F5F5F5',
      label: '</script><b>Kochschule</b>',
    });
    expect(labelled).toContain('label.textContent = config.label');
    expect(labelled).not.toContain('</script><b>');
    expect(labelled).toContain('u003c/script>');
  });

  it('zeigt ohne Namen kein Schild', () => {
    expect(html).toContain('"label":""');
  });
});
