import { DEFAULT_LOCALE, type Locale } from '../i18n/locale';

/** Ab dieser Zahl freier Plätze heißt es „Nur noch …“. */
export const FEW_SEATS_THRESHOLD = 3;

/**
 * Text zu freien Plätzen.
 * @example seatsLabel(0) // "Ausgebucht"
 * @example seatsLabel(1) // "Nur noch 1 Platz"
 * @example seatsLabel(3) // "Nur noch 3 Plätze"
 * @example seatsLabel(8) // "8 Plätze frei"
 */
export function seatsLabel(freeSeats: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isInteger(freeSeats) || freeSeats < 0) {
    throw new RangeError(`freeSeats muss eine ganze Zahl ≥ 0 sein, erhalten: ${freeSeats}`);
  }
  if (locale === 'en') {
    if (freeSeats === 0) return 'Sold out';
    if (freeSeats === 1) return 'Only 1 spot left';
    if (freeSeats <= FEW_SEATS_THRESHOLD) return `Only ${freeSeats} spots left`;
    return `${freeSeats} spots available`;
  }
  if (freeSeats === 0) return 'Ausgebucht';
  if (freeSeats === 1) return 'Nur noch 1 Platz';
  if (freeSeats <= FEW_SEATS_THRESHOLD) return `Nur noch ${freeSeats} Plätze`;
  return `${freeSeats} Plätze frei`;
}

/** true, wenn nur noch wenige Plätze frei sind (aber nicht 0). */
export function isFewSeatsLeft(freeSeats: number): boolean {
  return freeSeats > 0 && freeSeats <= FEW_SEATS_THRESHOLD;
}
