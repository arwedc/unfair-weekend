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
  offerTimeLabel,
  seatsLabel,
  toDate,
  type DateInput,
  type OfferCategory,
} from '@repo/shared';
import { DEFAULT_LOCALE, getLabels, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

import type { FeedOffer, Offer } from './types';

export const TIME_FILTERS = ['alle', 'heute', 'morgen', 'wochenende'] as const;
export type TimeFilter = (typeof TIME_FILTERS)[number];

/** Beschriftung der Zeitfilter in der gewählten Sprache. */
export function timeFilterLabels(locale: Locale = DEFAULT_LOCALE): Record<TimeFilter, string> {
  return getMessages(locale).logic.timeFilters;
}

export interface OfferFilters {
  /** Gewählte Kategorien. Leer = alle. Mehrere = Angebote aus irgendeiner davon. */
  categories: OfferCategory[];
  time: TimeFilter;
  query: string;
}

export const EMPTY_FILTERS: OfferFilters = { categories: [], time: 'alle', query: '' };

/**
 * Kategorie an- oder abwählen. Die Reihenfolge folgt immer OFFER_CATEGORIES,
 * damit Pillen und Abschnitte im Feed stabil stehen.
 */
export function toggleCategory(
  selected: readonly OfferCategory[],
  category: OfferCategory,
): OfferCategory[] {
  const next = selected.includes(category)
    ? selected.filter((value) => value !== category)
    : [...selected, category];
  return OFFER_CATEGORIES.filter((value) => next.includes(value));
}

export function hasActiveFilters(filters: OfferFilters): boolean {
  return filters.categories.length > 0 || filters.time !== 'alle' || filters.query.trim() !== '';
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

/**
 * Jedes Suchwort muss in Titel, Standort, Unternehmen, Kategorie oder Adresse vorkommen.
 * Die Kategorie zählt in beiden Sprachen („kochen“ und „cooking“ finden dasselbe).
 */
export function matchesSearch(offer: Searchable, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(
    [
      offer.title,
      offer.location_name,
      offer.company_name,
      getLabels('de').offerCategory[offer.category],
      getLabels('en').offerCategory[offer.category],
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
      (filters.categories.length === 0 || filters.categories.includes(offer.category)) &&
      matchesTimeFilter(offer, filters.time, now) &&
      matchesSearch(offer, filters.query),
  );
}

/** Anzahl Angebote je Kategorie, z. B. für die Kacheln im Filter-Sheet. */
export function countByCategory(
  offers: readonly Pick<Offer, 'category'>[],
): Record<OfferCategory, number> {
  const counts: Partial<Record<OfferCategory, number>> = {};
  for (const offer of offers) counts[offer.category] = (counts[offer.category] ?? 0) + 1;
  return Object.fromEntries(
    OFFER_CATEGORIES.map((category) => [category, counts[category] ?? 0]),
  ) as Record<OfferCategory, number>;
}

/**
 * Ähnliche Angebote für die Detailseite: gleiche Kategorie zuerst, dann der Rest.
 * Ohne das Angebot selbst und ohne ausgebuchte. Die Liste ist schon auf die Stadt eingegrenzt.
 */
export function similarOffers<T extends Pick<Offer, 'id' | 'category' | 'free_seats'>>(
  offers: readonly T[],
  current: Pick<Offer, 'id' | 'category'>,
  limit = 8,
): T[] {
  const candidates = offers.filter((offer) => offer.id !== current.id && offer.free_seats > 0);
  const same = candidates.filter((offer) => offer.category === current.category);
  const other = candidates.filter((offer) => offer.category !== current.category);
  return [...same, ...other].slice(0, limit);
}

/**
 * Kategorie oder Suche aktiv: Der Feed zeigt eine schlichte Trefferliste statt Abschnitten.
 * Der Zeitfilter allein behält die Abschnitte (sie zeigen dann nur diesen Tag).
 */
export function isListMode(filters: OfferFilters): boolean {
  return filters.categories.length > 0 || filters.query.trim() !== '';
}

/**
 * Mehrere Kategorien gewählt: Der Feed zeigt je Kategorie einen Abschnitt (untereinander),
 * die Angebote darin als Karussell. Kategorien ohne Treffer fallen weg.
 */
export function sectionsByCategory<T extends Pick<Offer, 'category'>>(
  offers: readonly T[],
  categories: readonly OfferCategory[],
): { category: OfferCategory; offers: T[] }[] {
  return categories
    .map((category) => ({
      category,
      offers: offers.filter((offer) => offer.category === category),
    }))
    .filter((section) => section.offers.length > 0);
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
/** Ab so vielen Sternen im Schnitt gilt ein Anbieter als Community-Liebling. */
export const HIGHLIGHT_MIN_RATING = 4.5;
/** „Bring deine Crew“: Angebote, bei denen man mindestens so viele Plätze holen kann. */
export const CREW_MIN_SEATS = 2;
/** Mega-Rabatte und Schnäppchen erscheinen erst ab so vielen Angeboten, sonst wirken sie leer. */
const RANKING_MIN_OFFERS = 2;

/** Bewertung eines Anbieters (aus `get_location_ratings`). */
export interface LocationRatingSummary {
  average: number;
  count: number;
}

interface SectionDraft {
  section: FeedSection;
  minOffers: number;
}

/** Wie viele Plätze schon vergeben sind. Ersatz für „Trending“, bis es echte Aufrufzahlen gibt. */
function seatsTaken(offer: Pick<Offer, 'capacity' | 'free_seats'>): number {
  return Math.max(0, offer.capacity - offer.free_seats);
}

/**
 * Reihen für „Entdecken“: Last Minute (heute), Gerade angesagt, Community-Lieblinge, Mega-Rabatte,
 * Frisch reingekommen, Bring deine Crew, Schnäppchen. Ein Angebot darf in mehreren
 * Reihen stehen. Nur buchbare Angebote; leere Reihen fallen weg.
 */
export function buildSections(
  offers: readonly FeedOffer[],
  options: {
    locale?: Locale;
    /** Für „Last Minute“ (heute in Berlin). Standard: jetzt. */
    now?: DateInput;
    /** Bewertungen je Standort (`location_id`). Ohne sie fällt „Community-Lieblinge“ weg. */
    ratings?: ReadonlyMap<string, LocationRatingSummary>;
  } = {},
): FeedSection[] {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const m = getMessages(locale).logic.sections;
  const ratings = options.ratings ?? new Map<string, LocationRatingSummary>();
  const available = offers.filter((offer) => offer.free_seats > 0);

  const draft = (key: string, title: string, items: FeedOffer[], minOffers = 1): SectionDraft => ({
    section: { key, title, offers: items },
    minOffers,
  });
  const ratingOf = (offer: FeedOffer) => ratings.get(offer.location_id);
  const now = options.now ?? new Date();

  const drafts: SectionDraft[] = [
    // Heute noch machbar, was zuerst startet bzw. endet, steht vorn
    draft(
      'last-minute',
      m.lastMinute,
      available
        .filter((offer) => matchesTimeFilter(offer, 'heute', now))
        .sort((a, b) => a.relevant_at.localeCompare(b.relevant_at)),
    ),
    // Wo gerade am meisten Plätze weggehen
    draft(
      'trending',
      m.trending,
      available
        .filter((offer) => seatsTaken(offer) > 0)
        .sort((a, b) => seatsTaken(b) - seatsTaken(a)),
    ),
    // Am besten bewertete Anbieter
    draft(
      'highlights',
      m.highlights,
      available
        .filter((offer) => (ratingOf(offer)?.average ?? 0) >= HIGHLIGHT_MIN_RATING)
        .sort(
          (a, b) =>
            (ratingOf(b)?.average ?? 0) - (ratingOf(a)?.average ?? 0) ||
            (ratingOf(b)?.count ?? 0) - (ratingOf(a)?.count ?? 0),
        ),
    ),
    // Höchster Rabatt in Prozent zuerst
    draft(
      'rabatt',
      m.deals,
      [...available].sort((a, b) => b.discount_percent - a.discount_percent),
      RANKING_MIN_OFFERS,
    ),
    // Zuletzt veröffentlicht
    draft(
      'neu',
      m.new,
      available
        .filter((offer): offer is FeedOffer & { createdAt: string } => offer.createdAt !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
    // Für mehrere Leute buchbar
    draft(
      'crew',
      m.crew,
      available.filter(
        (offer) => offer.max_per_user >= CREW_MIN_SEATS && offer.free_seats >= CREW_MIN_SEATS,
      ),
    ),
    // Günstigster Deal-Preis zuerst
    draft(
      'guenstig',
      m.budget,
      [...available].sort((a, b) => a.deal_price_cents - b.deal_price_cents),
      RANKING_MIN_OFFERS,
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
export function offerBadges(
  offer: BadgeSource,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): OfferBadge[] {
  const badges: OfferBadge[] = [
    { label: formatDiscount(offer.discount_percent, locale), variant: 'deal' },
  ];

  if (offer.free_seats === 0) {
    badges.push({ label: seatsLabel(0, locale), variant: 'soldOut' });
    return badges;
  }

  const time = offerTimeLabel(
    { type: offer.type, startsAt: offer.starts_at, endsAt: offer.ends_at },
    now,
    locale,
  );
  if (time.urgent) badges.push({ label: capitalize(time.text), variant: 'urgent' });
  if (isFewSeatsLeft(offer.free_seats)) {
    badges.push({ label: seatsLabel(offer.free_seats, locale), variant: 'neutral' });
  }
  return badges;
}

/**
 * Wann das Angebot stattfindet, als kurze Zeile.
 * Einzeltermin: „Heute, 18:00–21:00“. Zeitraum: „Einlösbar bis Sa., 14.11.“
 */
export function offerWhenText(
  offer: Timing,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const m = getMessages(locale).logic;
  if (offer.type === 'einzeltermin') {
    return capitalize(formatTimeRange(offer.starts_at, offer.ends_at, now, locale));
  }
  if (toDate(offer.starts_at).getTime() <= toDate(now).getTime()) {
    return m.redeemUntil(formatDay(offer.ends_at, now, locale));
  }
  return m.redeemRange(formatDateRange(offer.starts_at, offer.ends_at, now, locale));
}

/** Hinweis zur Stornofrist. Einzeltermin: bis X Std. vor Beginn. Zeitraum: jederzeit. */
export function cancelPolicyText(
  type: Offer['type'],
  cancelDeadlineHours: number | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const m = getMessages(locale).logic.cancelPolicy;
  if (type === 'zeitraum') return m.period;
  if (cancelDeadlineHours === undefined) return m.unknown;
  if (cancelDeadlineHours === 0) return m.untilStart;
  return m.hours(cancelDeadlineHours);
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
 * `null`, wenn die Koordinaten fehlen.
 */
export function placeKeyOf(offer: Pick<Offer, 'lat' | 'lng'>): string | null {
  // Die Typen sagen number, in der DB können die Koordinaten aber fehlen.
  const lat = offer.lat as number | null;
  const lng = offer.lng as number | null;
  if (lat === null || lng === null) return null;
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/**
 * Kategorien als Vorschläge unter der Suche (Karte). Ohne Eingabe alle,
 * sonst die, deren Name zum Text passt („koch“ → Kochen & Essen).
 */
export function categorySuggestions(
  query: string,
  locale: Locale = DEFAULT_LOCALE,
): OfferCategory[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...OFFER_CATEGORIES];
  const labels = getLabels(locale).offerCategory;
  return OFFER_CATEGORIES.filter((category) => {
    const label = normalize(labels[category]);
    return words.every((word) => label.includes(word));
  });
}

/** Fasst Angebote an derselben Adresse (gleiche Koordinaten) zu einem Pin zusammen. */
export function groupByPlace(offers: readonly Offer[]): OfferPlace[] {
  const places = new Map<string, OfferPlace>();
  for (const offer of offers) {
    const key = placeKeyOf(offer);
    if (key === null) continue;
    const lat = offer.lat;
    const lng = offer.lng;
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
