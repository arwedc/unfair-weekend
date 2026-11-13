/**
 * Datum und Uhrzeit, immer in Europe/Berlin, unabhängig von der Zeitzone des Geräts.
 *
 * `Intl` wird nur genutzt, um einen Zeitpunkt in Berliner Ortszeit (Ziffern)
 * umzurechnen. Wochentage und Formate bauen wir selbst, damit die Ausgabe auf
 * allen Plattformen identisch ist.
 */

import { DEFAULT_LOCALE, type Locale } from '../i18n/locale';

export const TIME_ZONE = 'Europe/Berlin';
export const LOCALE = 'de-DE';

/** Date-Objekt, ISO-String (z. B. aus Supabase) oder Millisekunden. */
export type DateInput = Date | string | number;

const MS_PER_DAY = 86_400_000;
const WEEKDAYS_SHORT: Record<Locale, readonly string[]> = {
  de: ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const MONTHS_SHORT_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const RELATIVE_DAYS: Record<Locale, { today: string; tomorrow: string; yesterday: string }> = {
  de: { today: 'heute', tomorrow: 'morgen', yesterday: 'gestern' },
  en: { today: 'today', tomorrow: 'tomorrow', yesterday: 'yesterday' },
};

let partsFormatter: Intl.DateTimeFormat | undefined;

function getPartsFormatter(): Intl.DateTimeFormat {
  partsFormatter ??= new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return partsFormatter;
}

export function toDate(input: DateInput): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Ungültiges Datum: ${String(input)}`);
  }
  return date;
}

export interface BerlinDateParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** 0–23 */
  hour: number;
  minute: number;
  /** 0 = Sonntag … 6 = Samstag */
  weekday: number;
}

/** Zerlegt einen Zeitpunkt in Berliner Ortszeit. */
export function berlinParts(input: DateInput): BerlinDateParts {
  const parts = getPartsFormatter().formatToParts(toDate(input));
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value);
  };
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return {
    year,
    month,
    day,
    hour: get('hour') % 24,
    minute: get('minute'),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

function berlinDayNumber(input: DateInput): number {
  const { year, month, day } = berlinParts(input);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/**
 * Anzahl Kalendertage (Berlin) von `from` bis `to`.
 * 0 = gleicher Tag, 1 = morgen, −1 = gestern. Sommer-/Winterzeit ist berücksichtigt.
 */
export function calendarDaysBetween(from: DateInput, to: DateInput): number {
  return berlinDayNumber(to) - berlinDayNumber(from);
}

/** Berliner Kalendertag als `YYYY-MM-DD`. */
export function berlinDateKey(input: DateInput): string {
  const { year, month, day } = berlinParts(input);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** @example formatTime(date) // "18:00" */
export function formatTime(input: DateInput): string {
  const { hour, minute } = berlinParts(input);
  return `${pad(hour)}:${pad(minute)}`;
}

export interface FormatDateOptions {
  withWeekday?: boolean;
  withYear?: boolean;
  /** Sprache der Ausgabe, Standard Deutsch. */
  locale?: Locale;
}

/**
 * @example formatDate(date) // "Sa., 14.11."
 * @example formatDate(date, { locale: 'en' }) // "Sat 14 Nov"
 */
export function formatDate(input: DateInput, options: FormatDateOptions = {}): string {
  const { withWeekday = true, withYear = false, locale = DEFAULT_LOCALE } = options;
  const { year, month, day, weekday } = berlinParts(input);
  const weekdayName = WEEKDAYS_SHORT[locale][weekday] ?? '';
  if (locale === 'en') {
    const date = `${day} ${MONTHS_SHORT_EN[month - 1] ?? ''}${withYear ? ` ${year}` : ''}`;
    return withWeekday ? `${weekdayName} ${date}` : date;
  }
  const date = `${pad(day)}.${pad(month)}.${withYear ? String(year) : ''}`;
  return withWeekday ? `${weekdayName}, ${date}` : date;
}

/** Tag relativ zu `now`: „heute“, „morgen“, „gestern“ oder „Sa., 14.11.“ (mit Jahr, falls nicht aktuell). */
export function formatDay(
  input: DateInput,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const diff = calendarDaysBetween(now, input);
  const words = RELATIVE_DAYS[locale];
  if (diff === 0) return words.today;
  if (diff === 1) return words.tomorrow;
  if (diff === -1) return words.yesterday;
  return formatDate(input, {
    withYear: berlinParts(input).year !== berlinParts(now).year,
    locale,
  });
}

/**
 * @example formatDateTime(start, now) // "heute, 18:00" | "morgen, 18:00" | "Sa., 14.11., 18:00"
 */
export function formatDateTime(
  input: DateInput,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  return `${formatDay(input, now, locale)}, ${formatTime(input)}`;
}

/**
 * Zeitspanne eines Einzeltermins.
 * @example formatTimeRange(start, end, now) // "heute, 18:00–21:00"
 * @example formatTimeRange(start, end, now) // "Sa., 14.11., 22:00 – So., 15.11., 02:00"
 */
export function formatTimeRange(
  start: DateInput,
  end: DateInput,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (calendarDaysBetween(start, end) === 0) {
    return `${formatDateTime(start, now, locale)}–${formatTime(end)}`;
  }
  return `${formatDateTime(start, now, locale)} – ${formatDateTime(end, now, locale)}`;
}

/**
 * Datumsbereich eines Zeitraum-Angebots (ohne Uhrzeit).
 * @example formatDateRange(from, until, now) // "14.11. – 20.11."
 */
export function formatDateRange(
  start: DateInput,
  end: DateInput,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const currentYear = berlinParts(now).year;
  const withYear = berlinParts(start).year !== currentYear || berlinParts(end).year !== currentYear;
  const from = formatDate(start, { withWeekday: false, withYear, locale });
  const until = formatDate(end, { withWeekday: false, withYear, locale });
  return from === until ? from : `${from} – ${until}`;
}
