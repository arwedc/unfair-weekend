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

export function voucherStatusInfo(voucher: Pick<Voucher, 'status' | 'offer_status'>): StatusInfo {
  const byStatus: Record<VoucherStatus, StatusInfo> = {
    aktiv: { label: 'Aktiv', tone: 'success' },
    eingeloest: { label: 'Eingelöst', tone: 'neutral' },
    storniert: { label: 'Storniert', tone: 'neutral' },
    abgelaufen: { label: 'Abgelaufen', tone: 'neutral' },
    no_show: { label: 'Nicht erschienen', tone: 'error' },
  };
  if (voucher.status === 'storniert' && voucher.offer_status !== 'aktiv') {
    return { label: 'Abgesagt', tone: 'warning' };
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
export function voucherWhenText(voucher: Timing, now: DateInput = new Date()): string {
  if (voucher.offer_type === 'einzeltermin') {
    const text = formatTimeRange(voucher.starts_at, voucher.ends_at, now);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (toDate(voucher.starts_at).getTime() <= toDate(now).getTime()) {
    return `Einlösbar bis ${formatDay(voucher.ends_at, now)}`;
  }
  return `Einlösbar ${formatDateRange(voucher.starts_at, voucher.ends_at, now)}`;
}

type CancelSource = Pick<Voucher, 'status' | 'can_cancel' | 'cancel_deadline' | 'offer_type'>;

/**
 * Hinweis zur Stornierung eines aktiven Codes.
 * Der Server entscheidet (`can_cancel`), die App erklärt es nur.
 */
export function cancelHint(voucher: CancelSource, now: DateInput = new Date()): string | null {
  if (voucher.status !== 'aktiv') return null;
  const deadline = optional(voucher.cancel_deadline);
  if (voucher.can_cancel) {
    if (voucher.offer_type === 'zeitraum' || !deadline) {
      return 'Du kannst kostenlos stornieren, solange du den Code nicht eingelöst hast.';
    }
    return `Kostenlos stornierbar bis ${formatDateTime(deadline, now)} Uhr.`;
  }
  if (deadline) return `Die Stornofrist ist seit ${formatDateTime(deadline, now)} Uhr vorbei.`;
  return 'Dieser Code lässt sich nicht mehr stornieren.';
}

/** Was mit einem vergangenen Code passiert ist, als kurze Zeile. */
export function pastSummary(
  voucher: Pick<Voucher, 'status' | 'offer_status' | 'redeemed_at' | 'cancelled_at'>,
  now: DateInput = new Date(),
): string {
  const redeemed = optional(voucher.redeemed_at);
  const cancelled = optional(voucher.cancelled_at);
  switch (voucher.status) {
    case 'eingeloest':
      return redeemed ? `Eingelöst am ${formatDay(redeemed, now)}` : 'Eingelöst';
    case 'storniert':
      if (voucher.offer_status !== 'aktiv') return 'Der Anbieter hat das Angebot abgesagt.';
      return cancelled ? `Storniert am ${formatDay(cancelled, now)}` : 'Storniert';
    case 'no_show':
      return 'Du bist nicht erschienen.';
    case 'abgelaufen':
      return 'Nicht eingelöst.';
    default:
      return '';
  }
}

export function seatsText(seats: number): string {
  return seats === 1 ? '1 Platz' : `${seats} Plätze`;
}

/** So viele Plätze darf man höchstens wählen. */
export function maxSelectableSeats(offer: { max_per_user: number; free_seats: number }): number {
  return Math.max(0, Math.min(offer.max_per_user, offer.free_seats));
}
