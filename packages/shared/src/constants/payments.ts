import { Constants, type Enums } from '../types';

/**
 * Zahlungen (Variante B, docs/SPEC-PAYMENTS.md).
 * Gleiche Werte wie die Postgres-Enums aus der Migration payments_fundament.
 */

/** Feste Regeln, die auch der Server so anwendet. */
export const PAYMENT_RULES = {
  /** Stripe-Minimum pro Buchung (start_paid_booking: BETRAG_ZU_GERING). */
  minAmountCents: 50,
  /** Provision höchstens 50 % (update_payment_settings). */
  maxCommissionBps: 5000,
  /** Währung aller Buchungen. */
  currency: 'eur',
} as const;

/** Lebenszyklus einer bezahlten Buchung (Postgres-Enum `booking_status`). */
export const BOOKING_STATUSES = Constants.public.Enums.booking_status;
export type BookingStatus = Enums<'booking_status'>;

export const BOOKING_STATUS_LABELS = {
  reserviert: 'Reserviert',
  abgelaufen: 'Reservierung abgelaufen',
  bezahlt: 'Bezahlt',
  storniert: 'Storniert',
  erstattet: 'Erstattet',
  eingeloest: 'Eingelöst',
  no_show: 'Nicht erschienen',
  ausgezahlt: 'Ausgezahlt',
} as const satisfies Record<BookingStatus, string>;

/** Warum eine Buchung storniert bzw. erstattet wurde (Postgres-Enum `booking_cancel_reason`). */
export type BookingCancelReason = Enums<'booking_cancel_reason'>;

export const BOOKING_CANCEL_REASON_LABELS = {
  nutzer: 'Selbst storniert',
  angebot_abgesagt: 'Angebot wurde abgesagt',
  angebot_entfernt: 'Angebot wurde entfernt',
  konto_geloescht: 'Konto gelöscht',
  zahlung_zu_spaet: 'Zahlung kam zu spät, Platz war vergeben',
} as const satisfies Record<BookingCancelReason, string>;

/** Erstattung (Postgres-Enum `refund_status`). */
export type RefundStatus = Enums<'refund_status'>;

export const REFUND_STATUS_LABELS = {
  offen: 'Erstattung wird vorbereitet',
  angefragt: 'Erstattung läuft',
  erstattet: 'Erstattet',
  fehlgeschlagen: 'Erstattung fehlgeschlagen',
} as const satisfies Record<RefundStatus, string>;

/** Transfer an den Standort (Postgres-Enum `transfer_status`). */
export type TransferStatus = Enums<'transfer_status'>;

export const TRANSFER_STATUS_LABELS = {
  ueberwiesen: 'Ausgezahlt',
  zurueckholen: 'Wird zurückgeholt',
  zurueckgeholt: 'Zurückgeholt',
  fehlgeschlagen: 'Rückholung fehlgeschlagen',
} as const satisfies Record<TransferStatus, string>;

/** Arbeitsliste des Stripe-Workers (Postgres-Enum `payment_job_kind`). */
export type PaymentJobKind = Enums<'payment_job_kind'>;

export const PAYMENT_JOB_KIND_LABELS = {
  pi_abbrechen: 'Zahlung abbrechen',
  erstatten: 'Erstatten',
  auszahlen: 'Auszahlen',
  auszahlung_zurueckholen: 'Auszahlung zurückholen',
} as const satisfies Record<PaymentJobKind, string>;

export type PaymentJobStatus = Enums<'payment_job_status'>;

export const PAYMENT_JOB_STATUS_LABELS = {
  offen: 'Offen',
  laeuft: 'Läuft',
  erledigt: 'Erledigt',
  fehlgeschlagen: 'Fehlgeschlagen',
} as const satisfies Record<PaymentJobStatus, string>;

/** Ergebnis von confirm_paid_booking (Webhook payment_intent.succeeded). */
export const CONFIRM_OUTCOMES = [
  'bestaetigt',
  'bestaetigt_nachtraeglich',
  'erstattung',
  'bereits_verarbeitet',
] as const;
export type ConfirmOutcome = (typeof CONFIRM_OUTCOMES)[number];
