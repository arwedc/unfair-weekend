import { describe, expect, it } from 'vitest';

import {
  bookingForVoucher,
  checkoutPhase,
  isTimerUrgent,
  shouldReleaseOnLeave,
  type CheckoutInput,
} from './checkout-logic';

const booking = (
  status: NonNullable<CheckoutInput['booking']>['status'],
  cancel_reason: NonNullable<CheckoutInput['booking']>['cancel_reason'] = null,
) => ({ status, cancel_reason });

describe('checkoutPhase', () => {
  it('ohne Buchung: start', () => {
    expect(checkoutPhase({ booking: null, submitted: false, secondsLeft: 0 })).toBe('start');
  });

  it('reserviert mit Restzeit: reserviert', () => {
    expect(
      checkoutPhase({ booking: booking('reserviert'), submitted: false, secondsLeft: 30 }),
    ).toBe('reserviert');
  });

  it('reserviert ohne Restzeit und ohne Zahlung: abgelaufen', () => {
    expect(
      checkoutPhase({ booking: booking('reserviert'), submitted: false, secondsLeft: 0 }),
    ).toBe('abgelaufen');
  });

  it('nach dem PaymentSheet wartet die App auf den Webhook, auch wenn der Timer abläuft', () => {
    expect(checkoutPhase({ booking: booking('reserviert'), submitted: true, secondsLeft: 0 })).toBe(
      'bestaetigen',
    );
    expect(checkoutPhase({ booking: booking('abgelaufen'), submitted: true, secondsLeft: 0 })).toBe(
      'bestaetigen',
    );
  });

  it('abgelaufen ohne Zahlung bleibt abgelaufen', () => {
    expect(
      checkoutPhase({ booking: booking('abgelaufen'), submitted: false, secondsLeft: 0 }),
    ).toBe('abgelaufen');
  });

  it.each(['bezahlt', 'eingeloest', 'no_show', 'ausgezahlt'] as const)('%s: bezahlt', (status) => {
    expect(checkoutPhase({ booking: booking(status), submitted: true, secondsLeft: 0 })).toBe(
      'bezahlt',
    );
  });

  it('verspätete Zahlung ohne freien Platz: zu_spaet', () => {
    expect(
      checkoutPhase({
        booking: booking('erstattet', 'zahlung_zu_spaet'),
        submitted: true,
        secondsLeft: 0,
      }),
    ).toBe('zu_spaet');
  });

  it('selbst abgebrochen: abgebrochen', () => {
    expect(
      checkoutPhase({
        booking: booking('storniert', 'nutzer'),
        submitted: false,
        secondsLeft: 100,
      }),
    ).toBe('abgebrochen');
  });
});

describe('shouldReleaseOnLeave', () => {
  it('gibt nur offene Reservierungen frei', () => {
    expect(shouldReleaseOnLeave('reserviert')).toBe(true);
    expect(shouldReleaseOnLeave('bestaetigen')).toBe(false);
    expect(shouldReleaseOnLeave('bezahlt')).toBe(false);
    expect(shouldReleaseOnLeave('start')).toBe(false);
  });
});

describe('isTimerUrgent', () => {
  it('nur in der letzten Minute', () => {
    expect(isTimerUrgent(61)).toBe(false);
    expect(isTimerUrgent(59)).toBe(true);
    expect(isTimerUrgent(0)).toBe(false);
  });
});

describe('bookingForVoucher', () => {
  it('findet die Buchung zum Code', () => {
    const list = [{ voucher_id: 'a' }, { voucher_id: null }, { voucher_id: 'b' }];
    expect(bookingForVoucher(list, 'b')).toBe(list[2]);
    expect(bookingForVoucher(list, 'x')).toBeNull();
    expect(bookingForVoucher(undefined, 'a')).toBeNull();
  });
});
