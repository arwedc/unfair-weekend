/**
 * Reine Logik für Feed und Karte: Zeitfilter, Suche, Abschnitte und Badges.
 * Ohne React und ohne Netzwerk, damit sie sich einfach testen lässt.
 * Zeiten immer in Europe/Berlin über die Helfer aus @repo/shared.
 */
import {
  berlinParts,
  calendarDaysBetween,
  formatDateRange,
  formatDay,
  formatDiscount,
  formatTimeRange,
  isFewSeatsLeft,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_LABELS,
  offerTimeLabel,
  seatsLabel,
  toDate,
  type DateInput,
  type OfferCategory,
} from '@repo/shared';

import type { FeedOffer, Offer } from './types';

export const TIME_FILTERS = ['alle', 'heute', 'morgen', 'wochenende'] as const;
export type TimeFilter = (typeof TIME_FILTERS)[number];

export const TIME_FILTER_LABELS = {
  alle: 'Alle',
  heute: 'Heute',
  morgen: 'Morgen',
  wochenende: 'Wochenende',
} as const satisfies Record<TimeFilter, string>;

export interface OfferFilters {
  category: OfferCategory | null;
  time: TimeFilter;
  query: string;
  /** Nur Angebote mit freien Plätzen. */
  onlyAvailable: boolean;
  /** Nur Angebote der eigenen Lieblingsorte (braucht Login). */
  favoritesOnly: boolean;
}

export const EMPTY_FILTERS: OfferFilters = {
  category: null,
  time: 'alle',
  query: '',
  onlyAvailable: false,
  favoritesOnly: false,
};

/** Anzahl gesetzter Filter ohne die Suche, z. B. für „Filter · 2“. */
export function activeFilterCount(filters: OfferFilters): number {
  return [
    filters.category !== null,
    filters.time !== 'alle',
    filters.onlyAvailable,
    filters.favoritesOnly,
  ].filter(Boolean).length;
}

export function hasActiveFilters(filters: OfferFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.query.trim() !== '';
}

type Timing = Pick<Offer, 'type' | 'starts_at' | 'ends_at'>;

/** Tage ab heute (0 = heute), die zum Filter gehören. Wochenende = nächster Samstag und Sonntag. */
function targetDayOffsets(filter: Exclude<TimeFilter, 'alle'>, now: DateInput): number[] {
  if (filter === 'heute') return [0];
  if (filter === 'morgen') return [1];
  const { year, month, day } = berlinParts(now);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sonntag
  if (weekday === 6) return [0, 1];
  if (weekday === 0) return [0];
  return [6 - weekday, 7 - weekday];
}

/**
 * Einzeltermin: zählt am Tag seines Beginns.
 * Zeitraum: zählt an jedem Tag, an dem er einlösbar ist.
 */
export function matchesTimeFilter(
  offer: Timing,
  filter: TimeFilter,
  now: DateInput = new Date(),
): boolean {
  if (filter === 'alle') return true;
  const startOffset = calendarDaysBetween(now, offer.starts_at);
  const endOffset =
    offer.type === 'einzeltermin' ? startOffset : calendarDaysBetween(now, offer.ends_at);
  return targetDayOffsets(filter, now).some((day) => day >= startOffset && day <= endOffset);
}

/** Kleinbuchstaben ohne Akzente, damit „münster“ auch „Munster“ findet. */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
}

type Searchable = Pick<Offer, 'title' | 'location_name' | 'company_name' | 'category' | 'address'>;

/** Jedes Suchwort muss in Titel, Standort, Unternehmen, Kategorie oder Adresse vorkommen. */
export function matchesSearch(offer: Searchable, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(
    [
      offer.title,
      offer.location_name,
      offer.company_name,
      OFFER_CATEGORY_LABELS[offer.category],
      offer.address,
    ].join(' '),
  );
  return words.every((word) => haystack.includes(word));
}

/**
 * Wendet alle Filter an. `favoriteLocationIds` braucht es nur für „Lieblingsorte“;
 * fehlt die Liste (nicht angemeldet), passt bei diesem Filter kein Angebot.
 */
export function filterOffers<T extends Offer>(
  offers: readonly T[],
  filters: OfferFilters,
  now: DateInput = new Date(),
  favoriteLocationIds?: ReadonlySet<string>,
): T[] {
  return offers.filter(
    (offer) =>
      (filters.category === null || offer.category === filters.category) &&
      (!filters.onlyAvailable || offer.free_seats > 0) &&
      (!filters.favoritesOnly || (favoriteLocationIds?.has(offer.location_id) ?? false)) &&
      matchesTimeFilter(offer, filters.time, now) &&
      matchesSearch(offer, filters.query),
  );
}

/**
 * Kategorien als Vorschläge unter der Suche. Ohne Eingabe alle,
 * sonst die, deren Name zum Text passt („koch“ → Kochen & Essen).
 */
export function categorySuggestions(query: string): OfferCategory[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...OFFER_CATEGORIES];
  return OFFER_CATEGORIES.filter((category) => {
    const label = normalize(OFFER_CATEGORY_LABELS[category]);
    return words.every((word) => label.includes(word));
  });
}

export interface FeedSections {
  /** Heute machbar und noch Plätze frei. */
  today: FeedOffer[];
  /** Einzeltermine in den nächsten drei Tagen (ohne heute). */
  startingSoon: FeedOffer[];
  /** Zuletzt veröffentlicht. */
  newest: FeedOffer[];
}

const SECTION_LIMIT = 8;
const STARTING_SOON_DAYS = 3;

/** Abschnitte für den Feed. Die Angebote kommen schon nach „als Nächstes relevant“ sortiert. */
export function buildSections(
  offers: readonly FeedOffer[],
  now: DateInput = new Date(),
): FeedSections {
  const today = offers
    .filter((offer) => offer.free_seats > 0 && matchesTimeFilter(offer, 'heute', now))
    .slice(0, SECTION_LIMIT);

  const startingSoon = offers
    .filter((offer) => {
      if (offer.type !== 'einzeltermin' || offer.free_seats === 0) return false;
      const days = calendarDaysBetween(now, offer.starts_at);
      return days >= 1 && days <= STARTING_SOON_DAYS;
    })
    .slice(0, SECTION_LIMIT);

  const newest = offers
    .filter((offer): offer is FeedOffer & { createdAt: string } => offer.createdAt !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, SECTION_LIMIT);

  return { today, startingSoon, newest };
}

export interface OfferBadge {
  label: string;
  variant: 'deal' | 'urgent' | 'neutral' | 'soldOut';
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type BadgeSource = Pick<
  Offer,
  'discount_percent' | 'free_seats' | 'type' | 'starts_at' | 'ends_at'
>;

/**
 * Badges auf dem Angebotsbild: immer der Rabatt, dazu Zeitdruck („Startet in 2 Std.“)
 * und knappe Plätze („Nur noch 2 Plätze“) bzw. „Ausgebucht“.
 */
export function offerBadges(offer: BadgeSource, now: DateInput = new Date()): OfferBadge[] {
  const badges: OfferBadge[] = [{ label: formatDiscount(offer.discount_percent), variant: 'deal' }];

  if (offer.free_seats === 0) {
    badges.push({ label: seatsLabel(0), variant: 'soldOut' });
    return badges;
  }

  const time = offerTimeLabel(
    { type: offer.type, startsAt: offer.starts_at, endsAt: offer.ends_at },
    now,
  );
  if (time.urgent) badges.push({ label: capitalize(time.text), variant: 'urgent' });
  if (isFewSeatsLeft(offer.free_seats)) {
    badges.push({ label: seatsLabel(offer.free_seats), variant: 'neutral' });
  }
  return badges;
}

/**
 * Wann das Angebot stattfindet, als kurze Zeile.
 * Einzeltermin: „Heute, 18:00–21:00“. Zeitraum: „Einlösbar bis Sa., 14.11.“
 */
export function offerWhenText(offer: Timing, now: DateInput = new Date()): string {
  if (offer.type === 'einzeltermin') {
    return capitalize(formatTimeRange(offer.starts_at, offer.ends_at, now));
  }
  if (toDate(offer.starts_at).getTime() <= toDate(now).getTime()) {
    return `Einlösbar bis ${formatDay(offer.ends_at, now)}`;
  }
  return `Einlösbar ${formatDateRange(offer.starts_at, offer.ends_at, now)}`;
}

/** Hinweis zur Stornofrist. Einzeltermin: bis X Std. vor Beginn. Zeitraum: jederzeit. */
export function cancelPolicyText(
  type: Offer['type'],
  cancelDeadlineHours: number | undefined,
): string {
  if (type === 'zeitraum')
    return 'Kostenlos stornierbar, solange du den Code nicht eingelöst hast.';
  if (cancelDeadlineHours === undefined) return 'Kostenlos stornierbar bis kurz vor Beginn.';
  if (cancelDeadlineHours === 0) return 'Kostenlos stornierbar bis zum Beginn.';
  return `Kostenlos stornierbar bis ${cancelDeadlineHours} Std. vor Beginn.`;
}

/** Eindeutige Standorte mit ihren Angeboten, für die Pins der Karte. */
export interface OfferPlace {
  key: string;
  lat: number;
  lng: number;
  offers: Offer[];
  /** Höchster Rabatt am Ort, steht im Pin. */
  maxDiscount: number;
}

/**
 * Schlüssel des Orts (gerundete Koordinaten). Angebote an derselben Adresse teilen ihn.
 * `null`, wenn die Koordinaten fehlen (laut Typen number, in der DB aber optional).
 */
export function placeKeyOf(offer: Pick<Offer, 'lat' | 'lng'>): string | null {
  const lat = offer.lat as number | null;
  const lng = offer.lng as number | null;
  if (lat === null || lng === null) return null;
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Fasst Angebote an derselben Adresse (gleiche Koordinaten) zu einem Pin zusammen. */
export function groupByPlace(offers: readonly Offer[]): OfferPlace[] {
  const places = new Map<string, OfferPlace>();
  for (const offer of offers) {
    const key = placeKeyOf(offer);
    if (key === null) continue;
    const { lat, lng } = offer;
    const place = places.get(key);
    if (place) {
      place.offers.push(offer);
      place.maxDiscount = Math.max(place.maxDiscount, offer.discount_percent);
    } else {
      places.set(key, { key, lat, lng, offers: [offer], maxDiscount: offer.discount_percent });
    }
  }
  return [...places.values()];
}
