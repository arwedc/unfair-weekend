import { describe, expect, it } from 'vitest';

import {
  buildSections,
  countByCategory,
  EMPTY_FILTERS,
  filterOffers,
  groupByPlace,
  hasActiveFilters,
  isListMode,
  sectionsByCategory,
  toggleCategory,
  matchesSearch,
  matchesTimeFilter,
  offerBadges,
  similarOffers,
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
      filterOffers(offers, { ...EMPTY_FILTERS, categories: ['sport_bewegung'] }, NOW).map(
        (o) => o.id,
      ),
    ).toEqual(['b']);
    expect(filterOffers(offers, { ...EMPTY_FILTERS, time: 'heute' }, NOW).map((o) => o.id)).toEqual(
      ['b'],
    );
    expect(
      filterOffers(offers, { categories: ['kochen_essen'], time: 'heute', query: '' }, NOW),
    ).toEqual([]);
  });

  it('zeigt bei mehreren Kategorien Angebote aus jeder davon', () => {
    const both = { ...EMPTY_FILTERS, categories: ['kochen_essen', 'sport_bewegung'] as const };
    expect(filterOffers(offers, { ...both, categories: [...both.categories] }, NOW)).toHaveLength(
      2,
    );
  });

  it('erkennt aktive Filter', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, time: 'morgen' })).toBe(true);
  });
});

describe('buildSections', () => {
  const titles = (offers: FeedOffer[]) =>
    buildSections(offers, { cityName: 'Münster', now: NOW }).map((section) => section.title);
  const ids = (offers: FeedOffer[], key: string) =>
    buildSections(offers, { cityName: 'Münster', now: NOW })
      .find((section) => section.key === key)
      ?.offers.map((o) => o.id);

  it('teilt in heute, startet bald und neu dabei', () => {
    const offers = [
      offer({ id: 'heute', starts_at: at(0, '19:00'), createdAt: '2026-11-08T10:00:00Z' }),
      offer({ id: 'heute-voll', starts_at: at(0, '20:00'), free_seats: 0 }),
      offer({ id: 'morgen', starts_at: at(1), createdAt: '2026-11-10T10:00:00Z' }),
      offer({ id: 'in-3', starts_at: at(3) }),
      offer({ id: 'in-4', starts_at: at(4) }),
      offer({ id: 'zeitraum', type: 'zeitraum', starts_at: at(-1), ends_at: at(6) }),
    ];
    expect(ids(offers, 'heute')).toEqual(['heute', 'zeitraum']);
    expect(ids(offers, 'bald')).toEqual(['morgen', 'in-3']);
    expect(ids(offers, 'neu')).toEqual(['morgen', 'heute']);
  });

  it('nennt die Stadt im Abschnitt für heute', () => {
    expect(titles([offer({ starts_at: at(0, '19:00') })])[0]).toBe('Heute in Münster');
  });

  it('macht aus jeder Kategorie einen Abschnitt, ohne ausgebuchte, „Sonstiges“ am Ende', () => {
    const offers = [
      offer({ id: 'pasta', category: 'kochen_essen' }),
      offer({ id: 'yoga', category: 'sport_bewegung' }),
      offer({ id: 'yoga-voll', category: 'sport_bewegung', free_seats: 0 }),
      offer({ id: 'rad', category: 'sonstiges' }),
    ];
    const sections = buildSections(offers, { cityName: 'Münster', now: NOW });
    const categories = sections.filter((section) => section.category);
    expect(categories.map((s) => [s.category, s.title, s.offers.map((o) => o.id)])).toEqual([
      ['kochen_essen', 'Kochen & Essen', ['pasta']],
      ['sport_bewegung', 'Sport & Bewegung', ['yoga']],
      ['sonstiges', 'Noch mehr entdecken', ['rad']],
    ]);
  });

  it('zeigt Themen erst ab zwei Angeboten', () => {
    const halb = offer({ id: 'halb', discount_percent: 50 });
    expect(ids([halb], 'halber-preis')).toBeUndefined();
    const halb2 = offer({ id: 'halb2', discount_percent: 66 });
    expect(ids([halb, halb2], 'halber-preis')).toEqual(['halb2', 'halb']);
  });

  it('findet Feierabend-Termine, kleine Preise und flexible Zeiträume', () => {
    const offers = [
      offer({ id: 'abend', starts_at: at(1, '18:00'), deal_price_cents: 900 }),
      offer({ id: 'spaet', starts_at: at(2, '19:30'), deal_price_cents: 2900 }),
      offer({ id: 'mittag', starts_at: at(2, '12:00'), deal_price_cents: 500 }),
      offer({ id: 'flex1', type: 'zeitraum', starts_at: at(-1), ends_at: at(6) }),
      offer({ id: 'flex2', type: 'zeitraum', starts_at: at(0), ends_at: at(9) }),
    ];
    expect(ids(offers, 'feierabend')).toEqual(['abend', 'spaet']);
    expect(ids(offers, 'budget')).toEqual(['mittag', 'abend']);
    expect(titles(offers)).toContain('Bis 15\u00a0€');
    expect(ids(offers, 'flexibel')).toEqual(['flex1', 'flex2']);
  });

  it('zeigt Favoriten ganz oben, in gemerkter Reihenfolge, nur wenn es welche gibt', () => {
    const offers = [offer({ id: 'a' }), offer({ id: 'b', free_seats: 0 }), offer({ id: 'c' })];
    const sections = buildSections(offers, {
      cityName: 'Münster',
      now: NOW,
      favoriteIds: ['c', 'weg', 'b'],
    });
    expect(sections[0]?.title).toBe('Deine Favoriten');
    expect(sections[0]?.offers.map((o) => o.id)).toEqual(['c', 'b']);
    expect(ids(offers, 'favoriten')).toBeUndefined();
  });

  it('lässt leere Abschnitte weg', () => {
    expect(buildSections([], { cityName: 'Vilnius', now: NOW })).toEqual([]);
  });

  it('begrenzt jeden Abschnitt auf 8 Angebote', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      offer({
        id: `o${i}`,
        starts_at: at(0, '20:00'),
        createdAt: `2026-11-0${(i % 9) + 1}T10:00:00Z`,
      }),
    );
    const sections = buildSections(many, { cityName: 'Münster', now: NOW });
    expect(sections.every((section) => section.offers.length <= 8)).toBe(true);
    expect(ids(many, 'heute')).toHaveLength(8);
    expect(ids(many, 'neu')).toHaveLength(8);
  });
});

describe('toggleCategory', () => {
  it('wählt an und ab und hält die feste Reihenfolge', () => {
    expect(toggleCategory([], 'sonstiges')).toEqual(['sonstiges']);
    expect(toggleCategory(['sonstiges'], 'kochen_essen')).toEqual(['kochen_essen', 'sonstiges']);
    expect(toggleCategory(['kochen_essen', 'sonstiges'], 'kochen_essen')).toEqual(['sonstiges']);
  });
});

describe('sectionsByCategory', () => {
  it('bildet je gewählter Kategorie einen Abschnitt und lässt leere weg', () => {
    const offers = [
      offer({ id: 'pasta', category: 'kochen_essen' }),
      offer({ id: 'yoga', category: 'sport_bewegung' }),
      offer({ id: 'wein', category: 'kochen_essen' }),
    ];
    const sections = sectionsByCategory(offers, [
      'kochen_essen',
      'kultur_events',
      'sport_bewegung',
    ]);
    expect(sections.map((s) => [s.category, s.offers.map((o) => o.id)])).toEqual([
      ['kochen_essen', ['pasta', 'wein']],
      ['sport_bewegung', ['yoga']],
    ]);
  });
});

describe('isListMode', () => {
  it('zeigt eine Liste bei Kategorie oder Suche, nicht beim Zeitfilter', () => {
    expect(isListMode(EMPTY_FILTERS)).toBe(false);
    expect(isListMode({ ...EMPTY_FILTERS, time: 'heute' })).toBe(false);
    expect(isListMode({ ...EMPTY_FILTERS, categories: ['kochen_essen'] })).toBe(true);
    expect(isListMode({ ...EMPTY_FILTERS, query: 'yoga' })).toBe(true);
    expect(isListMode({ ...EMPTY_FILTERS, query: '   ' })).toBe(false);
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

describe('countByCategory', () => {
  it('zählt je Kategorie, auch leere', () => {
    const counts = countByCategory([
      offer({ category: 'kochen_essen' }),
      offer({ category: 'kochen_essen' }),
      offer({ category: 'sonstiges' }),
    ]);
    expect(counts.kochen_essen).toBe(2);
    expect(counts.sonstiges).toBe(1);
    expect(counts.wellness_beauty).toBe(0);
  });
});

describe('similarOffers', () => {
  it('zeigt erst dieselbe Kategorie, ohne das Angebot selbst und ohne ausgebuchte', () => {
    const current = offer({ id: 'pasta', category: 'kochen_essen' });
    const offers = [
      current,
      offer({ id: 'yoga', category: 'sport_bewegung' }),
      offer({ id: 'wein', category: 'kochen_essen' }),
      offer({ id: 'sushi-voll', category: 'kochen_essen', free_seats: 0 }),
    ];
    expect(similarOffers(offers, current).map((o) => o.id)).toEqual(['wein', 'yoga']);
    expect(similarOffers(offers, current, 1).map((o) => o.id)).toEqual(['wein']);
  });
});
