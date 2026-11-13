/**
 * Relative Zeitlabels für Angebote, z. B. „startet in 2 Std.“ oder „endet morgen“.
 */
import type { OfferType } from '../constants/offers';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locale';
import { calendarDaysBetween, type DateInput, toDate } from './datetime';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Ab wann ein Angebot als „dringend“ gilt (für Badges, Hervorhebungen). */
export const URGENT_THRESHOLD_MS = 3 * MS_PER_HOUR;

export interface OfferTiming {
  type: OfferType;
  /** Einzeltermin: Beginn. Zeitraum: einlösbar ab. */
  startsAt: DateInput;
  /** Einzeltermin: Ende. Zeitraum: einlösbar bis. */
  endsAt: DateInput;
}

export type OfferPhase = 'bevorstehend' | 'laeuft' | 'beendet';

export interface TimeLabel {
  text: string;
  phase: OfferPhase;
  /** true, wenn Start bzw. Ende weniger als 3 Std. entfernt ist. */
  urgent: boolean;
}

/**
 * Abstand als Text: „in 45 Min.“, „in 2 Std.“, „morgen“, „in 3 Tagen“.
 * Unter 24 Std. zählen Stunden, darüber Berliner Kalendertage.
 */
export function relativeDistance(
  target: DateInput,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const words = WORDS[locale];
  const ms = toDate(target).getTime() - toDate(now).getTime();
  const minutes = Math.max(1, Math.ceil(ms / MS_PER_MINUTE));
  if (minutes < 60) {
    return words.inMinutes(minutes);
  }
  if (ms < MS_PER_DAY) {
    return words.inHours(Math.max(1, Math.floor(ms / MS_PER_HOUR)));
  }
  const days = calendarDaysBetween(now, target);
  return days <= 1 ? words.tomorrow : words.inDays(days);
}

const WORDS: Record<
  Locale,
  {
    inMinutes: (n: number) => string;
    inHours: (n: number) => string;
    inDays: (n: number) => string;
    tomorrow: string;
    starts: (distance: string) => string;
    ends: (distance: string) => string;
    running: string;
    ended: string;
  }
> = {
  de: {
    inMinutes: (n) => `in ${n} Min.`,
    inHours: (n) => `in ${n} Std.`,
    inDays: (n) => `in ${n} Tagen`,
    tomorrow: 'morgen',
    starts: (d) => `startet ${d}`,
    ends: (d) => `endet ${d}`,
    running: 'läuft gerade',
    ended: 'beendet',
  },
  en: {
    inMinutes: (n) => `in ${n} min`,
    inHours: (n) => `in ${n} ${n === 1 ? 'hr' : 'hrs'}`,
    inDays: (n) => `in ${n} days`,
    tomorrow: 'tomorrow',
    starts: (d) => `starts ${d}`,
    ends: (d) => `ends ${d}`,
    running: 'happening now',
    ended: 'ended',
  },
};

/**
 * Zeitlabel für eine Angebotskarte.
 * - vor Beginn: „startet in 2 Std.“
 * - Einzeltermin läuft: „läuft gerade“
 * - Zeitraum läuft: „endet in 3 Tagen“
 * - danach: „beendet“
 */
export function offerTimeLabel(
  timing: OfferTiming,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): TimeLabel {
  const words = WORDS[locale];
  const nowMs = toDate(now).getTime();
  const startMs = toDate(timing.startsAt).getTime();
  const endMs = toDate(timing.endsAt).getTime();

  if (nowMs < startMs) {
    return {
      text: words.starts(relativeDistance(startMs, nowMs, locale)),
      phase: 'bevorstehend',
      urgent: startMs - nowMs <= URGENT_THRESHOLD_MS,
    };
  }
  if (nowMs < endMs) {
    if (timing.type === 'einzeltermin') {
      return { text: words.running, phase: 'laeuft', urgent: false };
    }
    return {
      text: words.ends(relativeDistance(endMs, nowMs, locale)),
      phase: 'laeuft',
      urgent: endMs - nowMs <= URGENT_THRESHOLD_MS,
    };
  }
  return { text: words.ended, phase: 'beendet', urgent: false };
}

/**
 * Zeitpunkt, nach dem Angebote „als Nächstes relevant“ sortiert werden.
 * Gleiche Regel wie in der Datenbank: Einzeltermin → Beginn, Zeitraum → Ende.
 */
export function relevantAt(timing: OfferTiming): Date {
  return toDate(timing.type === 'einzeltermin' ? timing.startsAt : timing.endsAt);
}
