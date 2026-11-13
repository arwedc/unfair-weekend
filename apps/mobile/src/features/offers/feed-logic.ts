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
  formatPrice,
  formatTimeRange,
  isFewSeatsLeft,
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
}

export const EMPTY_FILTERS: OfferFilters = { category: null, time: 'alle', query: '' };

export function hasActiveFilters(filters: OfferFilters): boolean {
  return filters.category !== null || filters.time !== 'alle' || filters.query.trim() !== '';
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

export function filterOffers<T extends Offer>(
  offers: readonly T[],
  filters: OfferFilters,
  now: DateInput = new Date(),
): T[] {
  return offers.filter(
    (offer) =>
      (filters.category === null || offer.category === filters.category) &&
      matchesTimeFilter(offer, filters.time, now) &&
      matchesSearch(offer, filters.query),
  );
}

/**
 * Kategorie oder Suche aktiv: Der Feed zeigt eine schlichte Trefferliste statt Abschnitten.
 * Der Zeitfilter allein behält die Abschnitte (sie zeigen dann nur diesen Tag).
 */
export function isListMode(filters: OfferFilters): boolean {
  return filters.category !== null || filters.query.trim() !== '';
}

/** Ein Karussell im Feed, z. B. „Heute in Münster“ oder „Kochen & Essen“. */
export interface FeedSection {
  key: string;
  title: string;
  offers: FeedOffer[];
  /** Nur bei Kategorie-Abschnitten: „Alle“ filtert den Feed auf diese Kategorie. */
  category?: OfferCategory;
}

const SECTION_LIMIT = 8;
const STARTING_SOON_DAYS = 3;
/** Ab dieser Stunde (Berliner Zeit) gilt ein Termin als „nach Feierabend“. */
const EVENING_FROM_HOUR = 17;
const BIG_DISCOUNT_PERCENT = 50;
export const BUDGET_PRICE_CENTS = 1500;
/** Themen-Abschnitte erscheinen erst ab so vielen Angeboten, damit der Feed nicht zerfasert. */
const THEME_MIN_OFFERS = 2;

/** Kategorien mit eigenem Abschnitt. „Sonstiges“ steht nur in der Liste „Alle Angebote“. */
type SectionCategory = Exclude<OfferCategory, 'sonstiges'>;

interface SectionDraft {
  section: FeedSection;
  minOffers: number;
}

/**
 * Abschnitte für den Feed, im Wechsel aus Zeit, Themen und Kategorien.
 * Die Angebote kommen schon nach „als Nächstes relevant“ sortiert und sind bereits
 * auf Stadt und Zeitfilter eingegrenzt. Leere Abschnitte fallen weg.
 */
export function buildSections(
  offers: readonly FeedOffer[],
  options: { cityName: string; now?: DateInput },
): FeedSection[] {
  const now = options.now ?? new Date();
  const available = offers.filter((offer) => offer.free_seats > 0);

  const time = (key: string, title: string, items: FeedOffer[]): SectionDraft => ({
    section: { key, title, offers: items },
    minOffers: 1,
  });
  const theme = (key: string, title: string, items: FeedOffer[]): SectionDraft => ({
    section: { key, title, offers: items },
    minOffers: THEME_MIN_OFFERS,
  });
  const category = (value: SectionCategory): SectionDraft => ({
    section: {
      key: `kategorie-${value}`,
      title: OFFER_CATEGORY_LABELS[value],
      offers: available.filter((offer) => offer.category === value),
      category: value,
    },
    minOffers: 1,
  });

  const drafts: SectionDraft[] = [
    time(
      'heute',
      `Heute in ${options.cityName}`,
      available.filter((offer) => matchesTimeFilter(offer, 'heute', now)),
    ),
    time(
      'bald',
      'Startet bald',
      available.filter((offer) => {
        if (offer.type !== 'einzeltermin') return false;
        const days = calendarDaysBetween(now, offer.starts_at);
        return days >= 1 && days <= STARTING_SOON_DAYS;
      }),
    ),
    time(
      'knapp',
      'Fast ausgebucht',
      available.filter((offer) => isFewSeatsLeft(offer.free_seats)),
    ),
    theme(
      'halber-preis',
      'Zum halben Preis',
      available
        .filter((offer) => offer.discount_percent >= BIG_DISCOUNT_PERCENT)
        .sort((a, b) => b.discount_percent - a.discount_percent),
    ),
    time(
      'neu',
      'Neu dabei',
      offers
        .filter((offer): offer is FeedOffer & { createdAt: string } => offer.createdAt !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
    category('kochen_essen'),
    category('sport_bewegung'),
    theme(
      'feierabend',
      'Nach Feierabend',
      available.filter(
        (offer) =>
          offer.type === 'einzeltermin' && berlinParts(offer.starts_at).hour >= EVENING_FROM_HOUR,
      ),
    ),
    category('kreativ_workshops'),
    theme(
      'budget',
      `Bis ${formatPrice(BUDGET_PRICE_CENTS, { omitZeroCents: true })}`,
      available
        .filter((offer) => offer.deal_price_cents <= BUDGET_PRICE_CENTS)
        .sort((a, b) => a.deal_price_cents - b.deal_price_cents),
    ),
    category('wellness_beauty'),
    category('kultur_events'),
    theme(
      'flexibel',
      'Einlösen, wann du willst',
      available.filter((offer) => offer.type === 'zeitraum'),
    ),
  ];

  return drafts
    .filter(({ section, minOffers }) => section.offers.length >= minOffers)
    .map(({ section }) => ({ ...section, offers: section.offers.slice(0, SECTION_LIMIT) }));
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

/** Fasst Angebote an derselben Adresse (gleiche Koordinaten) zu einem Pin zusammen. */
export function groupByPlace(offers: readonly Offer[]): OfferPlace[] {
  const places = new Map<string, OfferPlace>();
  for (const offer of offers) {
    // Die Typen sagen number, in der DB können die Koordinaten aber fehlen.
    const lat = offer.lat as number | null;
    const lng = offer.lng as number | null;
    if (lat === null || lng === null) continue;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
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
