import { DEFAULT_LOCALE, type Locale } from '@repo/shared/i18n';
import { calendarDaysBetween, type DateInput } from '@repo/shared/utils';
import { getMessages } from '@/lib/i18n/messages';

/** „4,7“ auf Deutsch, „4.7“ auf Englisch (immer eine Nachkommastelle). */
export function formatRating(value: number, locale: Locale = DEFAULT_LOCALE): string {
  const text = value.toFixed(1);
  return locale === 'de' ? text.replace('.', ',') : text;
}

/** „1 Bewertung“, „12 Bewertungen“. */
export function reviewCountLabel(count: number, locale: Locale = DEFAULT_LOCALE): string {
  return getMessages(locale).reviews.count(count);
}

/** Wie viele Sterne voll gezeichnet werden (auf halbe Sterne gerundet). */
export function starFill(value: number, index: number): 'full' | 'half' | 'empty' {
  const rounded = Math.round(value * 2) / 2;
  if (rounded >= index) return 'full';
  if (rounded >= index - 0.5) return 'half';
  return 'empty';
}

/** „Heute“, „Gestern“, „vor 3 Tagen“, „vor 2 Wochen“, „vor 1 Monat“ (Berliner Kalendertage). */
export function reviewDateLabel(
  createdAt: DateInput,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const d = getMessages(locale).reviews.date;
  const days = Math.max(0, calendarDaysBetween(createdAt, now));
  if (days === 0) return d.today;
  if (days === 1) return d.yesterday;
  if (days < 7) return d.days(days);
  if (days < 30) return d.weeks(Math.floor(days / 7));
  if (days < 365) return d.months(Math.floor(days / 30));
  return d.years(Math.floor(days / 365));
}
