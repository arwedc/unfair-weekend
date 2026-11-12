/** Ab dieser Zahl freier Plätze heißt es „Nur noch …“. */
export const FEW_SEATS_THRESHOLD = 3;

/**
 * Text zu freien Plätzen.
 * @example seatsLabel(0) // "Ausgebucht"
 * @example seatsLabel(1) // "Nur noch 1 Platz"
 * @example seatsLabel(3) // "Nur noch 3 Plätze"
 * @example seatsLabel(8) // "8 Plätze frei"
 */
export function seatsLabel(freeSeats: number): string {
  if (!Number.isInteger(freeSeats) || freeSeats < 0) {
    throw new RangeError(`freeSeats muss eine ganze Zahl ≥ 0 sein, erhalten: ${freeSeats}`);
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
