import { describe, expect, it } from 'vitest';

import {
  clampSheetTop,
  pickSnap,
  SHEET_COLLAPSED,
  SHEET_EXPANDED,
  SHEET_MIDDLE,
  sheetSnaps,
} from './sheet-logic';

const SNAPS = [100, 400, 700] as const;

describe('pickSnap', () => {
  it('springt ohne Schwung zur nächsten Stufe', () => {
    expect(pickSnap(120, 0, SNAPS)).toBe(SHEET_EXPANDED);
    expect(pickSnap(380, 0, SNAPS)).toBe(SHEET_MIDDLE);
    expect(pickSnap(640, 0, SNAPS)).toBe(SHEET_COLLAPSED);
  });

  it('folgt einem schnellen Wurf in Wurfrichtung', () => {
    // Knapp unter „mittel“ losgelassen, aber kräftig nach unten geworfen
    expect(pickSnap(420, 2000, SNAPS)).toBe(SHEET_COLLAPSED);
    // Knapp über „mittel“, kräftig nach oben
    expect(pickSnap(380, -2000, SNAPS)).toBe(SHEET_EXPANDED);
  });
});

describe('clampSheetTop', () => {
  it('lässt Werte zwischen den Grenzen unverändert', () => {
    expect(clampSheetTop(300, 100, 700)).toBe(300);
  });

  it('bremst über die Grenzen hinaus wie ein Gummiband', () => {
    expect(clampSheetTop(60, 100, 700)).toBe(90);
    expect(clampSheetTop(740, 100, 700)).toBe(710);
  });
});

describe('sheetSnaps', () => {
  const base = { screenHeight: 844, topInset: 47, bottomInset: 34, headHeight: 96, rowHeight: 128 };

  it('liefert groß < mittel < klein', () => {
    const [expanded, middle, collapsed] = sheetSnaps(base);
    expect(expanded).toBe(111);
    expect(middle).toBe(380);
    expect(collapsed).toBe(844 - (96 + 128 + 34 + 12));
    expect(expanded).toBeLessThan(middle);
    expect(middle).toBeLessThan(collapsed);
  });

  it('hält „klein“ auch auf kleinen Bildschirmen unter „mittel“', () => {
    const [, middle, collapsed] = sheetSnaps({ ...base, screenHeight: 560, headHeight: 160 });
    expect(collapsed).toBeGreaterThanOrEqual(middle + 80);
  });
});
