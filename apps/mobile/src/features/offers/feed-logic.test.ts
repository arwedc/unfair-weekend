import { describe, expect, it } from 'vitest';

import {
  buildSections,
  EMPTY_FILTERS,
  filterOffers,
  groupByPlace,
  hasActiveFilters,
  matchesSearch,
  matchesTimeFilter,
  offerBadges,
} from './feed-logic';
import type { FeedOffer } from './types';

// Mittwoch, 11.11.2026, 12:00 Uhr in Berlin (Winterzeit, UTC+1)
const NOW = '2026-11-11T11:00:00Z';

/** Berliner Zeit am Tag `days` nach NOW. */
function at(days: number, time = '12:00'): string {
  const day = String(11 + days).padStart(2, '0');
  return `2026-11-${day}T${time}:00+01:00`;
}

function offer(overrides: Partial<FeedOffer> = {}): FeedOffer {
  return {
    id: 'o1',
    title: 'Pasta-Abend',
    category: 'kochen_essen',
    cover_image_path: 'a.jpg',
    image_paths: ['a.jpg'],
    original_price_cents: 4000,
    deal_price_cents: 2400,
    discount_percent: 40,
    type: 'einzeltermin',
    starts_at: at(1, '18:00'),
    ends_at: at(1, '21:00'),
    relevant_at: at(1, '18:00'),
    capacity: 10,
    free_seats: 8,
    max_per_user: 2,
    address: 'Prinzipalmarkt 1, 48143 Münster',
    lat: 51.9625,
    lng: 7.628,
    location_id: 'l1',
    location_name: 'Kochatelier',
    company_id: 'c1',
    company_name: 'Küchenfreunde GmbH',
    company_logo_path: '',
    createdAt: null,
    ...overrides,
  };
}

describe('matchesTimeFilter', () => {
  it('Einzeltermin zählt am Tag seines Beginns', () => {
    const morgen = offer();
    expect(matchesTimeFilter(morgen, 'heute', NOW)).toBe(false);
    expect(matchesTimeFilter(morgen, 'morgen', NOW)).toBe(true);
    expect(matchesTimeFilter(morgen, 'alle', NOW)).toBe(true);
  });

  it('Zeitraum zählt an jedem einlösbaren Tag', () => {
    const woche = offer({ type: 'zeitraum', starts_at: at(-2, '00:00'), ends_at: at(5, '22:00') });
    expect(matchesTimeFilter(woche, 'heute', NOW)).toBe(true);
    expect(matchesTimeFilter(woche, 'morgen', NOW)).toBe(true);
    expect(matchesTimeFilter(woche, 'wochenende', NOW)).toBe(true);
  });

  it('Zeitraum, der erst übermorgen beginnt, ist heute nicht dabei', () => {
    const spaeter = offer({ type: 'zeitraum', starts_at: at(2, '00:00'), ends_at: at(9, '22:00') });
    expect(matchesTimeFilter(spaeter, 'heute', NOW)).toBe(false);
    expect(matchesTimeFilter(spaeter, 'morgen', NOW)).toBe(false);
  });

  it('Wochenende ist der nächste Samstag und Sonntag', () => {
    expect(matchesTimeFilter(offer({ starts_at: at(3) }), 'wochenende', NOW)).toBe(true); // Sa.
    expect(matchesTimeFilter(offer({ starts_at: at(4) }), 'wochenende', NOW)).toBe(true); // So.
    expect(matchesTimeFilter(offer({ starts_at: at(2) }), 'wochenende', NOW)).toBe(false); // Fr.
    expect(matchesTimeFilter(offer({ starts_at: at(5) }), 'wochenende', NOW)).toBe(false); // Mo.
  });

  it('am Samstag zählen heute und morgen, am Sonntag nur heute', () => {
    const samstag = '2026-11-14T09:00:00Z';
    const sonntag = '2026-11-15T09:00:00Z';
    expect(matchesTimeFilter(offer({ starts_at: at(4) }), 'wochenende', samstag)).toBe(true);
    expect(matchesTimeFilter(offer({ starts_at: at(4) }), 'wochenende', sonntag)).toBe(true);
    expect(matchesTimeFilter(offer({ starts_at: at(10) }), 'wochenende', sonntag)).toBe(false);
  });

  it('rechnet in Berliner Kalendertagen, nicht in UTC', () => {
    // 23:30 Uhr Berlin am 11.11. ist in UTC noch der 11.11., 00:30 Uhr Berlin am 12.11. ebenfalls.
    expect(matchesTimeFilter(offer({ starts_at: at(0, '23:30') }), 'heute', NOW)).toBe(true);
    expect(matchesTimeFilter(offer({ starts_at: at(1, '00:30') }), 'heute', NOW)).toBe(false);
    expect(matchesTimeFilter(offer({ starts_at: at(1, '00:30') }), 'morgen', NOW)).toBe(true);
  });
});

describe('matchesSearch', () => {
  it('findet in Titel, Standort, Unternehmen, Kategorie und Adresse', () => {
    const o = offer();
    expect(matchesSearch(o, 'pasta')).toBe(true);
    expect(matchesSearch(o, 'kochatelier')).toBe(true);
    expect(matchesSearch(o, 'küchenfreunde')).toBe(true);
    expect(matchesSearch(o, 'essen')).toBe(true);
    expect(matchesSearch(o, 'prinzipalmarkt')).toBe(true);
    expect(matchesSearch(o, 'yoga')).toBe(false);
  });

  it('ignoriert Groß-/Kleinschreibung, Umlaute und Leerzeichen', () => {
    const o = offer();
    expect(matchesSearch(o, '  KUCHENFREUNDE ')).toBe(true);
    expect(matchesSearch(o, 'munster')).toBe(true);
    expect(matchesSearch(o, '')).toBe(true);
  });

  it('alle Suchwörter müssen vorkommen', () => {
    expect(matchesSearch(offer(), 'pasta kochatelier')).toBe(true);
    expect(matchesSearch(offer(), 'pasta yoga')).toBe(false);
  });
});

describe('filterOffers', () => {
  const offers = [
    offer({ id: 'a' }),
    offer({ id: 'b', category: 'sport_bewegung', title: 'Yoga', starts_at: at(0, '19:00') }),
  ];

  it('kombiniert Kategorie, Zeit und Suche', () => {
    expect(filterOffers(offers, EMPTY_FILTERS, NOW).map((o) => o.id)).toEqual(['a', 'b']);
    expect(
      filterOffers(offers, { ...EMPTY_FILTERS, category: 'sport_bewegung' }, NOW).map((o) => o.id),
    ).toEqual(['b']);
    expect(filterOffers(offers, { ...EMPTY_FILTERS, time: 'heute' }, NOW).map((o) => o.id)).toEqual(
      ['b'],
    );
    expect(
      filterOffers(offers, { category: 'kochen_essen', time: 'heute', query: '' }, NOW),
    ).toEqual([]);
  });

  it('erkennt aktive Filter', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, time: 'morgen' })).toBe(true);
  });
});

describe('buildSections', () => {
  it('teilt in heute, startet bald und neu dabei', () => {
    const offers = [
      offer({ id: 'heute', starts_at: at(0, '19:00'), createdAt: '2026-11-08T10:00:00Z' }),
      offer({ id: 'heute-voll', starts_at: at(0, '20:00'), free_seats: 0 }),
      offer({ id: 'morgen', starts_at: at(1), createdAt: '2026-11-10T10:00:00Z' }),
      offer({ id: 'in-3', starts_at: at(3) }),
      offer({ id: 'in-4', starts_at: at(4) }),
      offer({ id: 'zeitraum', type: 'zeitraum', starts_at: at(-1), ends_at: at(6) }),
    ];
    const sections = buildSections(offers, NOW);
    expect(sections.today.map((o) => o.id)).toEqual(['heute', 'zeitraum']);
    expect(sections.startingSoon.map((o) => o.id)).toEqual(['morgen', 'in-3']);
    expect(sections.newest.map((o) => o.id)).toEqual(['morgen', 'heute']);
  });

  it('begrenzt jeden Abschnitt auf 8 Angebote', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      offer({
        id: `o${i}`,
        starts_at: at(0, '20:00'),
        createdAt: `2026-11-0${(i % 9) + 1}T10:00:00Z`,
      }),
    );
    const sections = buildSections(many, NOW);
    expect(sections.today).toHaveLength(8);
    expect(sections.newest).toHaveLength(8);
  });
});

describe('offerBadges', () => {
  it('zeigt immer den Rabatt', () => {
    expect(offerBadges(offer({ starts_at: at(3) }), NOW)).toEqual([
      { label: '−40 %', variant: 'deal' },
    ]);
  });

  it('zeigt Zeitdruck und knappe Plätze', () => {
    const bald = offer({ starts_at: at(0, '14:00'), ends_at: at(0, '16:00'), free_seats: 2 });
    expect(offerBadges(bald, NOW).map((b) => [b.label, b.variant])).toEqual([
      ['−40 %', 'deal'],
      ['Startet in 2 Std.', 'urgent'],
      ['Nur noch 2 Plätze', 'neutral'],
    ]);
  });

  it('zeigt bei 0 Plätzen nur „Ausgebucht“', () => {
    const voll = offer({ starts_at: at(0, '14:00'), free_seats: 0 });
    expect(offerBadges(voll, NOW).map((b) => b.variant)).toEqual(['deal', 'soldOut']);
  });
});

describe('groupByPlace', () => {
  it('fasst Angebote an derselben Adresse zusammen und merkt sich den höchsten Rabatt', () => {
    const places = groupByPlace([
      offer({ id: 'a', discount_percent: 30 }),
      offer({ id: 'b', discount_percent: 50 }),
      offer({ id: 'c', lat: 51.95, lng: 7.64 }),
    ]);
    expect(places).toHaveLength(2);
    expect(places[0]?.offers.map((o) => o.id)).toEqual(['a', 'b']);
    expect(places[0]?.maxDiscount).toBe(50);
  });

  it('überspringt Angebote ohne Koordinaten', () => {
    expect(groupByPlace([offer({ lat: null as unknown as number })])).toEqual([]);
  });
});
