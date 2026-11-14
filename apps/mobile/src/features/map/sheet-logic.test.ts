import { describe, expect, it } from 'vitest';

import { clampSheetTop, isSheetAtTop, sheetBounds } from './sheet-logic';

describe('clampSheetTop', () => {
  it('lässt Werte zwischen den Grenzen unverändert', () => {
    expect(clampSheetTop(300, 0, 700)).toBe(300);
  });

  it('bremst über die Grenzen hinaus wie ein Gummiband', () => {
    expect(clampSheetTop(-40, 0, 700)).toBe(-10);
    expect(clampSheetTop(740, 0, 700)).toBe(710);
  });
});

describe('sheetBounds', () => {
  const base = { screenHeight: 844, bottomInset: 34, headHeight: 96, rowHeight: 128 };

  it('reicht von ganz oben bis „nur ein Angebot sichtbar“', () => {
    const { min, start, max } = sheetBounds(base);
    expect(min).toBe(0);
    expect(start).toBe(380);
    expect(max).toBe(844 - (96 + 128 + 34 + 12));
    expect(min).toBeLessThan(start);
    expect(start).toBeLessThan(max);
  });

  it('legt die unterste Lage auf kleinen Bildschirmen nie über den Start', () => {
    const { start, max } = sheetBounds({ ...base, screenHeight: 520, headHeight: 160 });
    expect(max).toBeGreaterThanOrEqual(start);
  });
});

describe('isSheetAtTop', () => {
  it('erkennt die oberste Lage mit kleiner Toleranz', () => {
    expect(isSheetAtTop(0, 0)).toBe(true);
    expect(isSheetAtTop(1.5, 0)).toBe(true);
    expect(isSheetAtTop(40, 0)).toBe(false);
  });
});
