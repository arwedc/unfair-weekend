import { TIME_ZONE } from '@repo/shared/utils';

/** Abstand der Berliner Ortszeit zu UTC (in ms) für einen bestimmten Zeitpunkt. */
function berlinOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Wandelt den Wert eines `<input type="datetime-local">` („2026-11-14T18:00“),
 * gemeint als Berliner Ortszeit, in einen UTC-Zeitpunkt um. Gibt `null` bei ungültiger Eingabe.
 */
export function berlinLocalToUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number) as [number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // Zweimal korrigieren, damit auch Tage mit Zeitumstellung stimmen.
  let result = naive - berlinOffsetMs(new Date(naive));
  result = naive - berlinOffsetMs(new Date(result));
  return new Date(result);
}
