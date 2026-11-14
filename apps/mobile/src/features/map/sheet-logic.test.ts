import { describe, expect, it } from 'vitest';

import { clampSheetTop, isSheetAtTop, SHEET_BACK_ZONE, sheetBounds } from './sheet-logic';

describe('clampSheetTop', () => {
  it('lässt Werte zwischen den Grenzen unverändert', () => {
    expect(clampSheetTop(300, 100, 700)).toBe(300);
  });

  it('stoppt oben hart an der obersten Lage', () => {
    expect(clampSheetTop(40, 100, 700)).toBe(100);
  });

  it('federt unten wie ein Gummiband', () => {
    expect(clampSheetTop(740, 100, 700)).toBe(710);
  });
});

describe('sheetBounds', () => {
  const base = {
    screenHeight: 844,
    topInset: 47,
    bottomInset: 34,
    headHeight: 96,
    separatorHeight: 9,
  };

  it('beginnt oben unter Statusleiste und Zurück-Knopf', () => {
    expect(sheetBounds(base).min).toBe(47 + SHEET_BACK_ZONE);
  });

  it('zeigt ganz unten nur noch Titel und einen Streifen des ersten Angebots', () => {
    const { min, start, max } = sheetBounds(base);
    expect(max).toBe(844 - (96 + 34 + 12 - 9));
    expect(min).toBeLessThan(start);
    expect(start).toBeLessThan(max);
  });

  it('legt die unterste Lage auf kleinen Bildschirmen nie über den Start', () => {
    const { start, max } = sheetBounds({ ...base, screenHeight: 420, headHeight: 260 });
    expect(max).toBeGreaterThanOrEqual(start);
  });
});

describe('isSheetAtTop', () => {
  it('erkennt die oberste Lage mit kleiner Toleranz', () => {
    expect(isSheetAtTop(100, 100)).toBe(true);
    expect(isSheetAtTop(101.5, 100)).toBe(true);
    expect(isSheetAtTop(140, 100)).toBe(false);
  });
});
