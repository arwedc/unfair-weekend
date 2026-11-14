/**
 * Filter und Sortierung der Bewertungsliste, alles über die URL (?sterne=…&sortierung=…).
 *
 * Erweitern:
 * - Neue Sortierung: Wert in REVIEW_SORTS, in list_my_reviews (Migration) und
 *   in `reviews.sortOptions` (de + en) ergänzen.
 * - Neuer Zeitraum: Tage in REVIEW_PERIOD_DAYS ergänzen, Text kommt aus `reviews.periodOption`.
 * - Neuer Filter: Feld in ReviewFilters, PARAM, parseReviewFilters und reviewsHref ergänzen.
 */

/** Sortierungen wie in der RPC list_my_reviews (p_sort). Die erste ist der Standard. */
export const REVIEW_SORTS = ['neueste', 'aelteste', 'beste', 'schlechteste'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];
export const DEFAULT_REVIEW_SORT: ReviewSort = 'neueste';

/** Wählbare Zeiträume in Tagen („letzte 30 Tage“), ohne Auswahl: alle. */
export const REVIEW_PERIOD_DAYS = [7, 30, 90, 365] as const;
export type ReviewPeriod = (typeof REVIEW_PERIOD_DAYS)[number];

export interface ReviewFilters {
  /** 1–5 Sterne, ohne Wert: alle. */
  rating?: number;
  sort: ReviewSort;
  period?: ReviewPeriod;
  page: number;
}

/** Namen der URL-Parameter (deutsch, wie die Pfade). */
export const REVIEW_PARAMS = {
  rating: 'sterne',
  sort: 'sortierung',
  period: 'zeitraum',
  page: 'seite',
} as const;

export type ReviewSearchParams = Partial<
  Record<(typeof REVIEW_PARAMS)[keyof typeof REVIEW_PARAMS], string | string[]>
>;

const DAY_MS = 24 * 60 * 60 * 1000;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string | number>(
  options: readonly T[],
  value: string | undefined,
): T | undefined {
  return options.find((option) => String(option) === value);
}

/** Liest die Filter aus den Suchparametern. Ungültige Werte fallen auf den Standard zurück. */
export function parseReviewFilters(params: ReviewSearchParams): ReviewFilters {
  const rating = Number(first(params[REVIEW_PARAMS.rating]));
  const page = Number(first(params[REVIEW_PARAMS.page]));
  return {
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
    sort: oneOf(REVIEW_SORTS, first(params[REVIEW_PARAMS.sort])) ?? DEFAULT_REVIEW_SORT,
    period: oneOf(REVIEW_PERIOD_DAYS, first(params[REVIEW_PARAMS.period])),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * Link auf die Bewertungsseite mit den aktuellen Filtern und den Änderungen in `changes`.
 * Ändert sich ein Filter, beginnt die Liste wieder auf Seite 1. Standardwerte fallen weg.
 */
export function reviewsHref(filters: ReviewFilters, changes: Partial<ReviewFilters> = {}): string {
  const next: ReviewFilters = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.rating) params.set(REVIEW_PARAMS.rating, String(next.rating));
  if (next.sort !== DEFAULT_REVIEW_SORT) params.set(REVIEW_PARAMS.sort, next.sort);
  if (next.period) params.set(REVIEW_PARAMS.period, String(next.period));
  if (next.page > 1) params.set(REVIEW_PARAMS.page, String(next.page));
  const query = params.toString();
  return query ? `/bewertungen?${query}` : '/bewertungen';
}

/** Ist irgendetwas anders als die Standardansicht (alle, neueste zuerst)? */
export function hasActiveFilters(filters: ReviewFilters): boolean {
  return Boolean(filters.rating || filters.period || filters.sort !== DEFAULT_REVIEW_SORT);
}

/** Beginn des Zeitraums als ISO-Zeitpunkt für p_since (rollierend wie last_30_days). */
export function periodSince(period: ReviewPeriod | undefined, now: Date): string | undefined {
  return period ? new Date(now.getTime() - period * DAY_MS).toISOString() : undefined;
}
