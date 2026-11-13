import { OFFER_CATEGORIES, type OfferCategory } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { PIN_ICON_PATHS, placeCategory } from './pin-icons';

const at = (...categories: OfferCategory[]) => ({
  offers: categories.map((category) => ({ category })) as never,
});

describe('PIN_ICON_PATHS', () => {
  it('hat für jede Kategorie ein Symbol', () => {
    for (const category of OFFER_CATEGORIES) {
      expect(PIN_ICON_PATHS[category].length).toBeGreaterThan(0);
    }
  });

  it('besteht nur aus SVG-Pfaden (beginnen mit M oder m)', () => {
    for (const paths of Object.values(PIN_ICON_PATHS)) {
      for (const d of paths) expect(d).toMatch(/^[Mm]/);
    }
  });
});

describe('placeCategory', () => {
  it('nimmt die Kategorie des einzigen Angebots', () => {
    expect(placeCategory(at('kochen_essen'))).toBe('kochen_essen');
  });

  it('nimmt bei mehreren Angeboten die häufigste Kategorie', () => {
    expect(placeCategory(at('kochen_essen', 'kultur_events', 'kultur_events'))).toBe(
      'kultur_events',
    );
  });

  it('nimmt bei Gleichstand die des ersten Angebots', () => {
    expect(placeCategory(at('wellness_beauty', 'sport_bewegung'))).toBe('wellness_beauty');
  });

  it('fällt ohne Angebote auf „Sonstiges“ zurück', () => {
    expect(placeCategory(at())).toBe('sonstiges');
  });
});
