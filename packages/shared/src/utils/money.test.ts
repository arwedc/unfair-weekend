import { describe, expect, it } from 'vitest';
import {
  discountPercent,
  formatDiscount,
  formatPrice,
  maxDealPriceCents,
  meetsMinDiscount,
} from './money';

const NBSP = ' ';

describe('formatPrice', () => {
  it('formatiert Cent als Euro mit Komma und geschütztem Leerzeichen', () => {
    expect(formatPrice(2450)).toBe(`24,50${NBSP}€`);
    expect(formatPrice(2400)).toBe(`24,00${NBSP}€`);
    expect(formatPrice(5)).toBe(`0,05${NBSP}€`);
    expect(formatPrice(0)).toBe(`0,00${NBSP}€`);
  });

  it('gruppiert Tausender mit Punkt', () => {
    expect(formatPrice(123_456_789)).toBe(`1.234.567,89${NBSP}€`);
    expect(formatPrice(100_000)).toBe(`1.000,00${NBSP}€`);
  });

  it('lässt ,00 auf Wunsch weg', () => {
    expect(formatPrice(2400, { omitZeroCents: true })).toBe(`24${NBSP}€`);
    expect(formatPrice(2450, { omitZeroCents: true })).toBe(`24,50${NBSP}€`);
  });

  it('lehnt negative und gebrochene Cent ab', () => {
    expect(() => formatPrice(-1)).toThrow(RangeError);
    expect(() => formatPrice(12.5)).toThrow(RangeError);
    expect(() => formatPrice(Number.NaN)).toThrow(RangeError);
  });
});

describe('discountPercent', () => {
  it('berechnet den Rabatt und rundet ab', () => {
    expect(discountPercent(4000, 2400)).toBe(40);
    expect(discountPercent(3000, 1999)).toBe(33);
    expect(discountPercent(999, 799)).toBe(20);
  });

  it('liefert 0 bei keinem oder negativem Rabatt', () => {
    expect(discountPercent(1000, 1000)).toBe(0);
    expect(discountPercent(1000, 1200)).toBe(0);
    expect(discountPercent(0, 0)).toBe(0);
  });

  it('liefert 100 für Gratis-Deals', () => {
    expect(discountPercent(1500, 0)).toBe(100);
  });
});

describe('meetsMinDiscount', () => {
  it('nutzt die exakte Ganzzahl-Regel des Servers', () => {
    expect(meetsMinDiscount(4000, 3200, 20)).toBe(true);
    expect(meetsMinDiscount(4000, 3201, 20)).toBe(false);
    expect(meetsMinDiscount(999, 799, 20)).toBe(true);
    expect(meetsMinDiscount(999, 800, 20)).toBe(false);
  });

  it('verlangt immer einen Deal-Preis unter dem Original', () => {
    expect(meetsMinDiscount(4000, 4000, 0)).toBe(false);
    expect(meetsMinDiscount(4000, 3999, 0)).toBe(true);
  });

  it('lehnt ungültige Prozentwerte ab', () => {
    expect(() => meetsMinDiscount(1000, 500, 101)).toThrow(RangeError);
    expect(() => meetsMinDiscount(1000, 500, 20.5)).toThrow(RangeError);
  });
});

describe('maxDealPriceCents', () => {
  it('liefert den höchsten erlaubten Deal-Preis', () => {
    expect(maxDealPriceCents(4000, 20)).toBe(3200);
    expect(maxDealPriceCents(999, 20)).toBe(799);
  });

  it('bleibt immer unter dem Originalpreis', () => {
    expect(maxDealPriceCents(100, 0)).toBe(99);
    expect(maxDealPriceCents(0, 20)).toBe(0);
  });

  it('ist konsistent mit meetsMinDiscount', () => {
    for (const original of [1, 99, 999, 1234, 4000, 10_001]) {
      for (const min of [0, 10, 20, 33, 50]) {
        const max = maxDealPriceCents(original, min);
        if (original > 1) {
          expect(meetsMinDiscount(original, max, min)).toBe(true);
        }
        expect(meetsMinDiscount(original, max + 1, min)).toBe(false);
      }
    }
  });
});

describe('formatDiscount', () => {
  it('nutzt echtes Minuszeichen und geschütztes Leerzeichen', () => {
    expect(formatDiscount(40)).toBe(`−40${NBSP}%`);
  });
});
