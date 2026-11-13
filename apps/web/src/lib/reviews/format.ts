import { calendarDaysBetween, type DateInput } from '@repo/shared/utils';

/** „4,7“ (immer eine Nachkommastelle, deutsches Komma). */
export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** „1 Bewertung“, „12 Bewertungen“. */
export function reviewCountLabel(count: number): string {
  return count === 1 ? '1 Bewertung' : `${count} Bewertungen`;
}

/** Wie viele Sterne voll gezeichnet werden (auf halbe Sterne gerundet). */
export function starFill(value: number, index: number): 'full' | 'half' | 'empty' {
  const rounded = Math.round(value * 2) / 2;
  if (rounded >= index) return 'full';
  if (rounded >= index - 0.5) return 'half';
  return 'empty';
}

/** „Heute“, „Gestern“, „vor 3 Tagen“, „vor 2 Wochen“, „vor 1 Monat“ (Berliner Kalendertage). */
export function reviewDateLabel(createdAt: DateInput, now: DateInput = new Date()): string {
  const days = Math.max(0, calendarDaysBetween(createdAt, now));
  if (days === 0) return 'Heute';
  if (days === 1) return 'Gestern';
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'vor 1 Woche' : `vor ${weeks} Wochen`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? 'vor 1 Monat' : `vor ${months} Monaten`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? 'vor 1 Jahr' : `vor ${years} Jahren`;
}
