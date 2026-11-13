/**
 * Reine Logik rund um Bewertungen: Zahlen und Texte für die Anzeige.
 * Ohne React und Netzwerk, Zeiten über die Berlin-Helfer aus @repo/shared.
 */
import { calendarDaysBetween, type DateInput } from '@repo/shared';
import { DEFAULT_LOCALE, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

export const REVIEW_COMMENT_MAX = 1000;

/** „4,7“ auf Deutsch, „4.7“ auf Englisch (immer eine Nachkommastelle). */
export function formatRating(value: number, locale: Locale = DEFAULT_LOCALE): string {
  const text = value.toFixed(1);
  return locale === 'de' ? text.replace('.', ',') : text;
}

/** „1 Bewertung“, „12 Bewertungen“. */
export function reviewCountLabel(count: number, locale: Locale = DEFAULT_LOCALE): string {
  return getMessages(locale).logic.reviewCount(count);
}

/** Wie viele Sterne voll gezeichnet werden (auf halbe Sterne gerundet). */
export function starFill(value: number, index: number): 'full' | 'half' | 'empty' {
  const rounded = Math.round(value * 2) / 2;
  if (rounded >= index) return 'full';
  if (rounded >= index - 0.5) return 'half';
  return 'empty';
}

/** Kurzer Text zur gewählten Sternzahl im Bewertungs-Sheet. */
export function ratingWord(rating: number, locale: Locale = DEFAULT_LOCALE): string | null {
  return rating >= 1 && rating <= 5
    ? getMessages(locale).logic.ratingWords[rating as 1 | 2 | 3 | 4 | 5]
    : null;
}

/** „Heute“, „Gestern“, „vor 3 Tagen“, „vor 2 Wochen“, „vor 1 Monat“, „vor 2 Jahren“ (Berliner Kalendertage). */
export function reviewDateLabel(
  createdAt: DateInput,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const m = getMessages(locale).logic.reviewDate;
  const days = Math.max(0, calendarDaysBetween(createdAt, now));
  if (days === 0) return m.today;
  if (days === 1) return m.yesterday;
  if (days < 7) return m.days(days);
  if (days < 30) return m.weeks(Math.floor(days / 7));
  if (days < 365) return m.months(Math.floor(days / 30));
  return m.years(Math.floor(days / 365));
}
