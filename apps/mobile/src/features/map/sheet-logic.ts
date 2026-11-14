/**
 * Reine Logik für das ziehbare Blatt über der Karte (Abschnitts-Seite).
 * Das Blatt bleibt dort liegen, wo man es loslässt (keine festen Stufen).
 * Läuft auch als Worklet auf dem UI-Thread, deshalb ohne Imports und mit 'worklet'.
 */

/** Hält die Kante beim Ziehen zwischen oberster und unterster Lage, mit etwas Gummiband. */
export function clampSheetTop(top: number, min: number, max: number): number {
  'worklet';
  if (top < min) return min - (min - top) * 0.25;
  if (top > max) return max + (top - max) * 0.25;
  return top;
}

export interface SheetBounds {
  /** Ganz oben: Die Liste verdeckt die Karte vollständig. */
  min: number;
  /** Beim Öffnen: Karte und Liste teilen sich den Bildschirm. */
  start: number;
  /** Ganz unten: nur Griff, Titel und das oberste Angebot. */
  max: number;
}

/** Grenzen für die obere Kante des Blatts in Punkten vom Bildschirmrand. */
export function sheetBounds(options: {
  screenHeight: number;
  bottomInset: number;
  headHeight: number;
  rowHeight: number;
}): SheetBounds {
  const start = Math.round(options.screenHeight * 0.45);
  const peek = options.headHeight + options.rowHeight + options.bottomInset + 12;
  // Unten bleibt immer ein Angebot sichtbar, auch auf kleinen Bildschirmen nicht über „start“.
  const max = Math.max(start, options.screenHeight - peek);
  return { min: 0, start, max };
}

/** Liegt das Blatt (fast) ganz oben? Dann scrollt die Liste statt das Blatt zu ziehen. */
export function isSheetAtTop(top: number, min: number): boolean {
  'worklet';
  return top <= min + 2;
}
