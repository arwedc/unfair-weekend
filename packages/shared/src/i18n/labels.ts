import type {
  BookingCancelReason,
  BookingStatus,
  PaymentJobKind,
  PaymentJobStatus,
  RefundStatus,
  TransferStatus,
} from '../constants/payments';
import {
  BOOKING_CANCEL_REASON_LABELS,
  BOOKING_STATUS_LABELS,
  PAYMENT_JOB_KIND_LABELS,
  PAYMENT_JOB_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
} from '../constants/payments';
import type { OfferCategory, OfferStatus, OfferType } from '../constants/offers';
import { OFFER_CATEGORY_LABELS, OFFER_STATUS_LABELS, OFFER_TYPE_LABELS } from '../constants/offers';
import type {
  AppRole,
  LocationStatus,
  VoucherCancelReason,
  VoucherStatus,
} from '../constants/status';
import {
  APP_ROLE_LABELS,
  LOCATION_STATUS_LABELS,
  VOUCHER_CANCEL_REASON_LABELS,
  VOUCHER_STATUS_LABELS,
} from '../constants/status';
import type { Locale } from './locale';

/** Alle Anzeigenamen für Enum-Werte, je Sprache. */
export interface EnumLabels {
  appRole: Record<AppRole, string>;
  offerCategory: Record<OfferCategory, string>;
  offerType: Record<OfferType, string>;
  offerStatus: Record<OfferStatus, string>;
  voucherStatus: Record<VoucherStatus, string>;
  voucherCancelReason: Record<VoucherCancelReason, string>;
  locationStatus: Record<LocationStatus, string>;
  bookingStatus: Record<BookingStatus, string>;
  bookingCancelReason: Record<BookingCancelReason, string>;
  refundStatus: Record<RefundStatus, string>;
  transferStatus: Record<TransferStatus, string>;
  paymentJobKind: Record<PaymentJobKind, string>;
  paymentJobStatus: Record<PaymentJobStatus, string>;
}

const de: EnumLabels = {
  appRole: APP_ROLE_LABELS,
  offerCategory: OFFER_CATEGORY_LABELS,
  offerType: OFFER_TYPE_LABELS,
  offerStatus: OFFER_STATUS_LABELS,
  voucherStatus: VOUCHER_STATUS_LABELS,
  voucherCancelReason: VOUCHER_CANCEL_REASON_LABELS,
  locationStatus: LOCATION_STATUS_LABELS,
  bookingStatus: BOOKING_STATUS_LABELS,
  bookingCancelReason: BOOKING_CANCEL_REASON_LABELS,
  refundStatus: REFUND_STATUS_LABELS,
  transferStatus: TRANSFER_STATUS_LABELS,
  paymentJobKind: PAYMENT_JOB_KIND_LABELS,
  paymentJobStatus: PAYMENT_JOB_STATUS_LABELS,
};

const en: EnumLabels = {
  appRole: { nutzer: 'User', standort: 'Venue', admin: 'Admin' },
  offerCategory: {
    kochen_essen: 'Cooking & Food',
    sport_bewegung: 'Sports & Fitness',
    kreativ_workshops: 'Creative & Workshops',
    wellness_beauty: 'Wellness & Beauty',
    kultur_events: 'Culture & Events',
    sonstiges: 'Other',
  },
  offerType: { einzeltermin: 'Single date', zeitraum: 'Time period' },
  offerStatus: { aktiv: 'Active', abgesagt: 'Cancelled', entfernt: 'Removed' },
  voucherStatus: {
    aktiv: 'Active',
    storniert: 'Cancelled',
    eingeloest: 'Redeemed',
    no_show: 'No-show',
    abgelaufen: 'Expired',
  },
  voucherCancelReason: {
    nutzer: 'Cancelled by you',
    angebot_abgesagt: 'Offer was cancelled',
    angebot_entfernt: 'Offer was removed',
    konto_geloescht: 'Account deleted',
  },
  locationStatus: { pending: 'Under review', approved: 'Approved', rejected: 'Rejected' },
  bookingStatus: {
    reserviert: 'Reserved',
    abgelaufen: 'Reservation expired',
    bezahlt: 'Paid',
    storniert: 'Cancelled',
    erstattet: 'Refunded',
    eingeloest: 'Redeemed',
    no_show: 'No-show',
    ausgezahlt: 'Paid out',
  },
  bookingCancelReason: {
    nutzer: 'Cancelled by you',
    angebot_abgesagt: 'Offer was cancelled',
    angebot_entfernt: 'Offer was removed',
    konto_geloescht: 'Account deleted',
    zahlung_zu_spaet: 'Payment arrived too late, the spot was taken',
  },
  refundStatus: {
    offen: 'Refund being prepared',
    angefragt: 'Refund in progress',
    erstattet: 'Refunded',
    fehlgeschlagen: 'Refund failed',
  },
  transferStatus: {
    ueberwiesen: 'Paid out',
    zurueckholen: 'Being reversed',
    zurueckgeholt: 'Reversed',
    fehlgeschlagen: 'Reversal failed',
  },
  paymentJobKind: {
    pi_abbrechen: 'Cancel payment',
    erstatten: 'Refund',
    auszahlen: 'Pay out',
    auszahlung_zurueckholen: 'Reverse payout',
  },
  paymentJobStatus: {
    offen: 'Open',
    laeuft: 'Running',
    erledigt: 'Done',
    fehlgeschlagen: 'Failed',
  },
};

const LABELS: Record<Locale, EnumLabels> = { de, en };

/**
 * Anzeigenamen der Enum-Werte in der gewünschten Sprache.
 * @example getLabels('en').offerCategory.kochen_essen // "Cooking & Food"
 */
export function getLabels(locale: Locale): EnumLabels {
  return LABELS[locale];
}
