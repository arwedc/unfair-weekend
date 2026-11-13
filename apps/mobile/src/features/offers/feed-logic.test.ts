import { describe, expect, it } from 'vitest';

import {
  buildSections,
  countByCategory,
  EMPTY_FILTERS,
  filterOffers,
  groupByPlace,
  hasActiveFilters,
  isListMode,
  type LocationRatingSummary,
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
  const rated = (entries: [string, number, number][]) =>
    new Map(entries.map(([id, average, count]) => [id, { average, count }]));
  const ids = (
    offers: FeedOffer[],
    key: string,
    ratings?: ReadonlyMap<string, LocationRatingSummary>,
  ) =>
    buildSections(offers, { ratings })
      .find((section) => section.key === key)
      ?.offers.map((o) => o.id);

  it('zeigt die Reihen in fester Reihenfolge mit Titeln', () => {
    const offers = [
      offer({
        id: 'a',
        capacity: 10,
        free_seats: 4,
        createdAt: '2026-11-08T10:00:00Z',
        location_id: 'l1',
      }),
      offer({ id: 'b', capacity: 10, free_seats: 9, max_per_user: 1, location_id: 'l2' }),
    ];
    const sections = buildSections(offers, { ratings: rated([['l1', 4.8, 12]]) });
    expect(sections.map((s) => s.key)).toEqual([
      'trending',
      'highlights',
      'rabatt',
      'neu',
      'crew',
      'guenstig',
    ]);
    expect(sections.map((s) => s.title)).toEqual([
      'Gerade angesagt 🔥',
      'Community-Lieblinge ⭐',
      'Mega-Rabatte 💥',
      'Frisch reingekommen ✨',
      'Bring deine Crew 👯',
      'Schnäppchen 💸',
    ]);
  });

  it('sortiert „Gerade angesagt“ nach vergebenen Plätzen', () => {
    const offers = [
      offer({ id: 'wenig', capacity: 10, free_seats: 9 }),
      offer({ id: 'viel', capacity: 10, free_seats: 2 }),
      offer({ id: 'keiner', capacity: 10, free_seats: 10 }),
    ];
    expect(ids(offers, 'trending')).toEqual(['viel', 'wenig']);
  });

  it('zeigt Community-Lieblinge erst ab 4,5 Sternen, die besten zuerst', () => {
    const offers = [
      offer({ id: 'top', location_id: 'l1' }),
      offer({ id: 'gut', location_id: 'l2' }),
      offer({ id: 'mittel', location_id: 'l3' }),
    ];
    const ratings = rated([
      ['l1', 4.9, 40],
      ['l2', 4.6, 8],
      ['l3', 4.1, 50],
    ]);
    expect(ids(offers, 'highlights', ratings)).toEqual(['top', 'gut']);
    expect(ids(offers, 'highlights')).toBeUndefined();
  });

  it('sortiert Mega-Rabatte nach Prozent und Schnäppchen nach Preis', () => {
    const offers = [
      offer({ id: 'teuer', discount_percent: 20, deal_price_cents: 4000 }),
      offer({ id: 'rabatt', discount_percent: 60, deal_price_cents: 2000 }),
      offer({ id: 'billig', discount_percent: 30, deal_price_cents: 800 }),
    ];
    expect(ids(offers, 'rabatt')).toEqual(['rabatt', 'billig', 'teuer']);
    expect(ids(offers, 'guenstig')).toEqual(['billig', 'rabatt', 'teuer']);
  });

  it('zeigt Ranglisten erst ab zwei Angeboten', () => {
    expect(ids([offer({ id: 'allein' })], 'rabatt')).toBeUndefined();
    expect(ids([offer({ id: 'allein' })], 'guenstig')).toBeUndefined();
  });

  it('nimmt in „Bring deine Crew“ nur Angebote für mehrere Plätze', () => {
    const offers = [
      offer({ id: 'gruppe', max_per_user: 4, free_seats: 6 }),
      offer({ id: 'solo', max_per_user: 1 }),
      offer({ id: 'letzter-platz', max_per_user: 4, free_seats: 1 }),
    ];
    expect(ids(offers, 'crew')).toEqual(['gruppe']);
  });

  it('sortiert „Frisch reingekommen“ nach Veröffentlichung', () => {
    const offers = [
      offer({ id: 'alt', createdAt: '2026-11-01T10:00:00Z' }),
      offer({ id: 'neu', createdAt: '2026-11-10T10:00:00Z' }),
      offer({ id: 'ohne' }),
    ];
    expect(ids(offers, 'neu')).toEqual(['neu', 'alt']);
  });

  it('lässt Ausgebuchte und leere Reihen weg', () => {
    expect(buildSections([])).toEqual([]);
    expect(buildSections([offer({ free_seats: 0 }), offer({ id: 'x', free_seats: 0 })])).toEqual(
      [],
    );
  });

  it('begrenzt jede Reihe auf 8 Angebote', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      offer({ id: `o${i}`, discount_percent: 20 + i, capacity: 10, free_seats: 5 }),
    );
    const sections = buildSections(many);
    expect(sections.every((section) => section.offers.length <= 8)).toBe(true);
    expect(ids(many, 'rabatt')).toHaveLength(8);
  });

  it('übersetzt die Titel', () => {
    const offers = [offer({ id: 'a' }), offer({ id: 'b' })];
    expect(buildSections(offers, { locale: 'en' }).map((s) => s.title)).toContain('Mega deals 💥');
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
