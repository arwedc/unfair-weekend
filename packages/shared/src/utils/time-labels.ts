/**
 * Relative Zeitlabels für Angebote, z. B. „startet in 2 Std.“ oder „endet morgen“.
 */
import type { OfferType } from '../constants/offers';
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
export function relativeDistance(target: DateInput, now: DateInput = new Date()): string {
  const ms = toDate(target).getTime() - toDate(now).getTime();
  const minutes = Math.max(1, Math.ceil(ms / MS_PER_MINUTE));
  if (minutes < 60) {
    return `in ${minutes} Min.`;
  }
  if (ms < MS_PER_DAY) {
    return `in ${Math.max(1, Math.floor(ms / MS_PER_HOUR))} Std.`;
  }
  const days = calendarDaysBetween(now, target);
  return days <= 1 ? 'morgen' : `in ${days} Tagen`;
}

/**
 * Zeitlabel für eine Angebotskarte.
 * - vor Beginn: „startet in 2 Std.“
 * - Einzeltermin läuft: „läuft gerade“
 * - Zeitraum läuft: „endet in 3 Tagen“
 * - danach: „beendet“
 */
export function offerTimeLabel(timing: OfferTiming, now: DateInput = new Date()): TimeLabel {
  const nowMs = toDate(now).getTime();
  const startMs = toDate(timing.startsAt).getTime();
  const endMs = toDate(timing.endsAt).getTime();

  if (nowMs < startMs) {
    return {
      text: `startet ${relativeDistance(startMs, nowMs)}`,
      phase: 'bevorstehend',
      urgent: startMs - nowMs <= URGENT_THRESHOLD_MS,
    };
  }
  if (nowMs < endMs) {
    if (timing.type === 'einzeltermin') {
      return { text: 'läuft gerade', phase: 'laeuft', urgent: false };
    }
    return {
      text: `endet ${relativeDistance(endMs, nowMs)}`,
      phase: 'laeuft',
      urgent: endMs - nowMs <= URGENT_THRESHOLD_MS,
    };
  }
  return { text: 'beendet', phase: 'beendet', urgent: false };
}

/**
 * Zeitpunkt, nach dem Angebote „als Nächstes relevant“ sortiert werden.
 * Gleiche Regel wie in der Datenbank: Einzeltermin → Beginn, Zeitraum → Ende.
 */
export function relevantAt(timing: OfferTiming): Date {
  return toDate(timing.type === 'einzeltermin' ? timing.startsAt : timing.endsAt);
}
