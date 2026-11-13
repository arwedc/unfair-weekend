import { describe, expect, it } from 'vitest';
import {
  bookingAmountCents,
  bookingMode,
  clockOffsetMs,
  commissionCents,
  formatCommission,
  formatCountdown,
  isPayableAmount,
  payoutAccountStatus,
  payoutCents,
  percentToBps,
  reservationSecondsLeft,
} from './payments';

describe('commissionCents', () => {
  it('rechnet wie private.commission_cents (gleiche Fälle wie der SQL-Test)', () => {
    expect(commissionCents(2400, 1500)).toBe(360);
    expect(commissionCents(999, 1500)).toBe(150); // 149,85 → 150
    expect(commissionCents(1001, 1250)).toBe(125); // 125,125 → 125
    expect(commissionCents(4800, 1500)).toBe(720);
  });

  it('rundet ,5 auf', () => {
    expect(commissionCents(10, 1500)).toBe(2); // 1,5 → 2
    expect(commissionCents(30, 500)).toBe(2); // 1,5 → 2
  });

  it('0 % und 0 Cent', () => {
    expect(commissionCents(2400, 0)).toBe(0);
    expect(commissionCents(0, 1500)).toBe(0);
  });

  it('lehnt ungültige Werte ab', () => {
    expect(() => commissionCents(-1, 1500)).toThrow(RangeError);
    expect(() => commissionCents(10.5, 1500)).toThrow(RangeError);
    expect(() => commissionCents(100, 5001)).toThrow(RangeError);
  });
});

describe('payoutCents und bookingAmountCents', () => {
  it('Netto = Betrag − Provision', () => {
    expect(payoutCents(2400, 1500)).toBe(2040);
    expect(payoutCents(4800, 1500)).toBe(4080);
  });

  it('Betrag = Deal-Preis × Plätze', () => {
    expect(bookingAmountCents(2400, 2)).toBe(4800);
    expect(() => bookingAmountCents(2400, 0)).toThrow(RangeError);
  });

  it('Mindestbetrag 0,50 €', () => {
    expect(isPayableAmount(49)).toBe(false);
    expect(isPayableAmount(50)).toBe(true);
  });
});

describe('formatCommission und percentToBps', () => {
  it('zeigt Prozent mit Komma', () => {
    expect(formatCommission(1500)).toBe('15 %');
    expect(formatCommission(1250)).toBe('12,5 %');
    expect(formatCommission(1205)).toBe('12,05 %');
    expect(formatCommission(0)).toBe('0 %');
  });

  it('liest Eingaben aus dem Formular', () => {
    expect(percentToBps('15')).toBe(1500);
    expect(percentToBps('12,5')).toBe(1250);
    expect(percentToBps(12.05)).toBe(1205);
    expect(percentToBps('50')).toBe(5000);
    expect(percentToBps('51')).toBeNull();
    expect(percentToBps('-1')).toBeNull();
    expect(percentToBps('abc')).toBeNull();
    expect(percentToBps('1,234')).toBeNull();
  });
});

describe('bookingMode', () => {
  it('wertet das Flag zentral aus', () => {
    expect(bookingMode({ payments_enabled: true })).toBe('bezahlung');
    expect(bookingMode({ payments_enabled: false })).toBe('code');
  });

  it('ohne Einstellungen gilt Variante A', () => {
    expect(bookingMode(null)).toBe('code');
    expect(bookingMode(undefined)).toBe('code');
  });
});

describe('Reservierungs-Timer', () => {
  const now = new Date('2026-11-20T17:00:00Z');

  it('Restzeit in Sekunden, nie negativ', () => {
    expect(reservationSecondsLeft('2026-11-20T17:10:00Z', now)).toBe(600);
    expect(reservationSecondsLeft('2026-11-20T17:00:00.500Z', now)).toBe(1);
    expect(reservationSecondsLeft('2026-11-20T16:59:00Z', now)).toBe(0);
  });

  it('gleicht eine falsch gehende Geräteuhr aus', () => {
    // Gerät geht 2 Minuten nach: Server meldet 17:02, Gerät zeigt 17:00
    const offset = clockOffsetMs('2026-11-20T17:02:00Z', now);
    expect(offset).toBe(120_000);
    expect(reservationSecondsLeft('2026-11-20T17:12:00Z', now, offset)).toBe(600);
  });

  it('formatiert den Countdown', () => {
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});

describe('payoutAccountStatus', () => {
  const base = {
    is_ready: false,
    details_submitted: false,
    disabled_reason: null,
    requirements_due: [],
  };

  it('ohne Konto', () => {
    expect(payoutAccountStatus(null)).toBe('fehlt');
  });

  it('Stufen bis bereit', () => {
    expect(payoutAccountStatus(base)).toBe('angelegt');
    expect(payoutAccountStatus({ ...base, details_submitted: true })).toBe('in_pruefung');
    expect(
      payoutAccountStatus({
        ...base,
        details_submitted: true,
        requirements_due: ['external_account'],
      }),
    ).toBe('eingeschraenkt');
    expect(payoutAccountStatus({ ...base, is_ready: true, details_submitted: true })).toBe('aktiv');
  });
});
