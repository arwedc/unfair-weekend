/**
 * Zahlungen (Variante B): Provision, Buchungsart, Reservierungs-Timer,
 * Status des Stripe-Kontos. Alle Beträge sind ganze Cent (EUR).
 *
 * Die Wahrheit liegt im Server (start_paid_booking rechnet Betrag und
 * Provision aus der DB). Diese Helfer dienen der Anzeige und nutzen dieselben
 * Formeln wie die SQL-Funktionen.
 */

import { PAYMENT_RULES } from '../constants/payments';

/** Geschütztes Leerzeichen vor „%“ (wie vor „€“ in money.ts). */
const NBSP = ' ';

function assertCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} muss eine ganze Zahl ≥ 0 (Cent) sein, erhalten: ${value}`);
  }
}

function assertBps(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > PAYMENT_RULES.maxCommissionBps) {
    throw new RangeError(
      `Provision muss zwischen 0 und ${PAYMENT_RULES.maxCommissionBps} Basispunkten liegen, erhalten: ${value}`,
    );
  }
}

/**
 * Provision in Cent, kaufmännisch gerundet. Gleiche Formel wie
 * `private.commission_cents()`: (Betrag × bps + 5000) / 10000, ganzzahlig.
 * @example commissionCents(2400, 1500) // 360 (15 % von 24,00 €)
 */
export function commissionCents(amountCents: number, commissionBps: number): number {
  assertCents(amountCents, 'amountCents');
  assertBps(commissionBps);
  return Math.floor((amountCents * commissionBps + 5000) / 10000);
}

/** Netto für den Standort: Betrag minus Provision. */
export function payoutCents(amountCents: number, commissionBps: number): number {
  return amountCents - commissionCents(amountCents, commissionBps);
}

/** Gesamtbetrag einer Buchung: Deal-Preis × Plätze. */
export function bookingAmountCents(dealPriceCents: number, seats: number): number {
  assertCents(dealPriceCents, 'dealPriceCents');
  if (!Number.isInteger(seats) || seats < 1) {
    throw new RangeError(`seats muss eine ganze Zahl ≥ 1 sein, erhalten: ${seats}`);
  }
  return dealPriceCents * seats;
}

/** Kann dieser Betrag bezahlt gebucht werden? (Stripe-Minimum 0,50 €) */
export function isPayableAmount(amountCents: number): boolean {
  return amountCents >= PAYMENT_RULES.minAmountCents;
}

/**
 * Basispunkte ↔ Prozent für das Admin-Formular.
 * @example formatCommission(1500) // "15 %"
 * @example formatCommission(1250) // "12,5 %"
 */
export function formatCommission(commissionBps: number): string {
  assertBps(commissionBps);
  const whole = Math.trunc(commissionBps / 100);
  const fraction = String(commissionBps % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return `${whole}${fraction ? `,${fraction}` : ''}${NBSP}%`;
}

/** „12,5“ bzw. 12.5 → 1250. Gibt null zurück, wenn der Wert ungültig ist. */
export function percentToBps(percent: string | number): number | null {
  const text = String(percent).trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text)) return null;
  const bps = Math.round(Number(text) * 100);
  return bps <= PAYMENT_RULES.maxCommissionBps ? bps : null;
}

/** Was die Clients beim Buchen anzeigen. Ausgewertet nur an dieser Stelle (plus DB). */
export type BookingMode = 'code' | 'bezahlung';

/**
 * Zentrale Auswertung des Flags `payments_enabled` in den Clients.
 * Fehlen die Einstellungen (Laden fehlgeschlagen), gilt Variante A: Code holen.
 * Der Server entscheidet trotzdem selbst (Trigger und start_paid_booking).
 */
export function bookingMode(
  paymentSettings: { payments_enabled: boolean } | null | undefined,
): BookingMode {
  return paymentSettings?.payments_enabled === true ? 'bezahlung' : 'code';
}

/**
 * Restzeit einer Reservierung in Sekunden (nie negativ).
 * `serverNow` aus start_paid_booking gleicht eine falsch gehende Geräteuhr aus:
 * Die Differenz zwischen Gerät und Server beim Start wird herausgerechnet.
 */
export function reservationSecondsLeft(
  reservedUntil: string | Date,
  now: Date = new Date(),
  clockOffsetMs = 0,
): number {
  const until = new Date(reservedUntil).getTime();
  return Math.max(0, Math.ceil((until - (now.getTime() + clockOffsetMs)) / 1000));
}

/** Abstand Server − Gerät in Millisekunden (für reservationSecondsLeft). */
export function clockOffsetMs(serverNow: string | Date, deviceNow: Date = new Date()): number {
  return new Date(serverNow).getTime() - deviceNow.getTime();
}

/** „9:05“ für den Timer. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Status des Stripe-Kontos eines Standorts (aus der Zeile in `stripe_accounts`). */
export type PayoutAccountStatus = 'fehlt' | 'angelegt' | 'in_pruefung' | 'eingeschraenkt' | 'aktiv';

export const PAYOUT_ACCOUNT_STATUS_LABELS = {
  fehlt: 'Noch nicht eingerichtet',
  angelegt: 'Einrichtung begonnen',
  in_pruefung: 'Wird von Stripe geprüft',
  eingeschraenkt: 'Eingeschränkt, Angaben fehlen',
  aktiv: 'Bereit für Auszahlungen',
} as const satisfies Record<PayoutAccountStatus, string>;

export function payoutAccountStatus(
  account:
    | {
        is_ready: boolean | null;
        details_submitted: boolean;
        disabled_reason: string | null;
        requirements_due: string[];
      }
    | null
    | undefined,
): PayoutAccountStatus {
  if (!account) return 'fehlt';
  if (account.is_ready) return 'aktiv';
  if (account.disabled_reason || account.requirements_due.length > 0) {
    return account.details_submitted ? 'eingeschraenkt' : 'angelegt';
  }
  return account.details_submitted ? 'in_pruefung' : 'angelegt';
}
