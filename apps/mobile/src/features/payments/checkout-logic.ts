/**
 * Ablauf des Bezahlens (Variante B) ohne Oberfläche.
 *
 * Ob bezahlt wurde, entscheidet nur der Server (Webhook → paid_bookings). Die App leitet
 * ihren Zustand aus der Buchungszeile ab, die sie per Realtime beobachtet, plus der
 * lokalen Info, ob das PaymentSheet schon erfolgreich abgeschickt wurde.
 */
import type { Tables } from '@repo/shared/types';

export type PaidBooking = Tables<'paid_bookings'>;

export type CheckoutPhase =
  /** Noch keine Reservierung: Zusammenfassung und „Bezahlen“. */
  | 'start'
  /** Plätze reserviert, Timer läuft, Zahlung offen. */
  | 'reserviert'
  /** PaymentSheet fertig, wir warten auf die Bestätigung von Stripe (Webhook). */
  | 'bestaetigen'
  /** Bezahlt, der Code ist da. */
  | 'bezahlt'
  /** Timer abgelaufen, ohne dass bezahlt wurde. */
  | 'abgelaufen'
  /** Zahlung kam zu spät und der Platz war weg: automatische Vollerstattung. */
  | 'zu_spaet'
  /** Abgebrochen oder storniert. */
  | 'abgebrochen';

export interface CheckoutInput {
  booking: Pick<PaidBooking, 'status' | 'cancel_reason'> | null;
  /** PaymentSheet meldete Erfolg (die Bestätigung durch den Webhook kann noch fehlen). */
  submitted: boolean;
  /** Restzeit der Reservierung in Sekunden. */
  secondsLeft: number;
}

export function checkoutPhase({ booking, submitted, secondsLeft }: CheckoutInput): CheckoutPhase {
  if (!booking) return 'start';
  switch (booking.status) {
    case 'bezahlt':
    case 'eingeloest':
    case 'no_show':
    case 'ausgezahlt':
      return 'bezahlt';
    case 'reserviert':
      // Nach erfolgreicher Zahlung zählt der Timer nicht mehr: Der Server bestätigt
      // auch eine verspätete Zahlung, solange der Platz noch frei ist.
      if (submitted) return 'bestaetigen';
      return secondsLeft > 0 ? 'reserviert' : 'abgelaufen';
    case 'abgelaufen':
      // Bezahlt, aber die Reservierung lief ab: Der Webhook entscheidet gleich (Platz frei
      // → bezahlt, sonst Erstattung).
      return submitted ? 'bestaetigen' : 'abgelaufen';
    case 'storniert':
    case 'erstattet':
      return booking.cancel_reason === 'zahlung_zu_spaet' ? 'zu_spaet' : 'abgebrochen';
  }
}

/** Soll die App die Reservierung beim Verlassen des Screens sofort freigeben? */
export function shouldReleaseOnLeave(phase: CheckoutPhase): boolean {
  return phase === 'reserviert';
}

/** Rest unter einer Minute: Timer wird hervorgehoben. */
export function isTimerUrgent(secondsLeft: number): boolean {
  return secondsLeft > 0 && secondsLeft < 60;
}

/** Codes, deren Buchung bezahlt wurde, für die Anzeige „Bezahlt“ in der Code-Ansicht. */
export function bookingForVoucher<T extends Pick<PaidBooking, 'voucher_id'>>(
  bookings: readonly T[] | undefined,
  voucherId: string,
): T | null {
  return bookings?.find((booking) => booking.voucher_id === voucherId) ?? null;
}
