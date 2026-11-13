/** Reine Logik rund um Gutscheincodes: Status, Storno-Hinweise, Sortierung. Ohne React, mit Tests. */
import {
  formatDateRange,
  formatDateTime,
  formatDay,
  formatTimeRange,
  toDate,
  type DateInput,
  type RpcRow,
  type VoucherStatus,
} from '@repo/shared';
import { DEFAULT_LOCALE, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

/** Ein eigener Code (eine Zeile aus `get_my_vouchers`). */
export type Voucher = RpcRow<'get_my_vouchers'>;

export interface StatusInfo {
  label: string;
  tone: 'success' | 'neutral' | 'warning' | 'error';
}

/** Die Zeile aus der Datenbank kann Felder leer lassen, auch wenn die Typen `string` sagen. */
function optional(value: string | null | undefined): string | null {
  return value ? value : null;
}

export function voucherStatusInfo(
  voucher: Pick<Voucher, 'status' | 'offer_status'>,
  locale: Locale = DEFAULT_LOCALE,
): StatusInfo {
  const m = getMessages(locale).logic.voucherStatus;
  const byStatus: Record<VoucherStatus, StatusInfo> = {
    aktiv: { label: m.aktiv, tone: 'success' },
    eingeloest: { label: m.eingeloest, tone: 'neutral' },
    storniert: { label: m.storniert, tone: 'neutral' },
    abgelaufen: { label: m.abgelaufen, tone: 'neutral' },
    no_show: { label: m.no_show, tone: 'error' },
  };
  if (voucher.status === 'storniert' && voucher.offer_status !== 'aktiv') {
    return { label: m.abgesagt, tone: 'warning' };
  }
  return byStatus[voucher.status];
}

export function isActive(voucher: Pick<Voucher, 'status'>): boolean {
  return voucher.status === 'aktiv';
}

/** Aktive Codes zuerst, der Rest als Verlauf. Die Reihenfolge vom Server bleibt erhalten. */
export function splitVouchers<T extends Pick<Voucher, 'status'>>(
  vouchers: readonly T[],
): { active: T[]; past: T[] } {
  return {
    active: vouchers.filter((voucher) => isActive(voucher)),
    past: vouchers.filter((voucher) => !isActive(voucher)),
  };
}

type Timing = Pick<Voucher, 'offer_type' | 'starts_at' | 'ends_at'>;

/** Wann der Code gilt. Einzeltermin: „Morgen, 18:00–21:00“. Zeitraum: „Einlösbar bis Sa., 14.11.“ */
export function voucherWhenText(
  voucher: Timing,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const m = getMessages(locale).logic;
  if (voucher.offer_type === 'einzeltermin') {
    const text = formatTimeRange(voucher.starts_at, voucher.ends_at, now, locale);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (toDate(voucher.starts_at).getTime() <= toDate(now).getTime()) {
    return m.redeemUntil(formatDay(voucher.ends_at, now, locale));
  }
  return m.redeemRange(formatDateRange(voucher.starts_at, voucher.ends_at, now, locale));
}

type CancelSource = Pick<Voucher, 'status' | 'can_cancel' | 'cancel_deadline' | 'offer_type'>;

/**
 * Hinweis zur Stornierung eines aktiven Codes.
 * Der Server entscheidet (`can_cancel`), die App erklärt es nur.
 */
export function cancelHint(
  voucher: CancelSource,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (voucher.status !== 'aktiv') return null;
  const m = getMessages(locale).logic.cancelHint;
  const deadline = optional(voucher.cancel_deadline);
  if (voucher.can_cancel) {
    if (voucher.offer_type === 'zeitraum' || !deadline) return m.period;
    return m.until(formatDateTime(deadline, now, locale));
  }
  if (deadline) return m.over(formatDateTime(deadline, now, locale));
  return m.none;
}

/** Was mit einem vergangenen Code passiert ist, als kurze Zeile. */
export function pastSummary(
  voucher: Pick<Voucher, 'status' | 'offer_status' | 'redeemed_at' | 'cancelled_at'>,
  now: DateInput = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  const m = getMessages(locale).logic.past;
  const redeemed = optional(voucher.redeemed_at);
  const cancelled = optional(voucher.cancelled_at);
  switch (voucher.status) {
    case 'eingeloest':
      return redeemed ? m.redeemedOn(formatDay(redeemed, now, locale)) : m.redeemed;
    case 'storniert':
      if (voucher.offer_status !== 'aktiv') return m.offerCancelled;
      return cancelled ? m.cancelledOn(formatDay(cancelled, now, locale)) : m.cancelled;
    case 'no_show':
      return m.noShow;
    case 'abgelaufen':
      return m.expired;
    default:
      return '';
  }
}

/**
 * Inhalt des QR-Codes: Link auf die Einlöse-Seite der Partner-Website, damit der Partner
 * mit der normalen Handy-Kamera scannen kann. Ohne Website-Adresse nur der Token
 * (`redeem_voucher` nimmt beides an).
 */
export function voucherQrValue(token: string, webUrl: string | null): string {
  if (!webUrl) return token;
  return `${webUrl.replace(/\/+$/, '')}/einloesen/${encodeURIComponent(token)}`;
}

export function seatsText(seats: number, locale: Locale = DEFAULT_LOCALE): string {
  return getMessages(locale).logic.seats(seats);
}

/** So viele Plätze darf man höchstens wählen. */
export function maxSelectableSeats(offer: { max_per_user: number; free_seats: number }): number {
  return Math.max(0, Math.min(offer.max_per_user, offer.free_seats));
}
