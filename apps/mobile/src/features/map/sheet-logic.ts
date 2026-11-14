/**
 * Reine Logik für das ziehbare Blatt über der Karte (Abschnitts-Seite).
 * Das Blatt bleibt dort liegen, wo man es loslässt (keine festen Stufen).
 * Läuft auch als Worklet auf dem UI-Thread, deshalb ohne Imports und mit 'worklet'.
 */

/** Platz über dem Blatt in der obersten Lage: Statusleiste plus Zurück-Knopf. */
export const SHEET_BACK_ZONE = 52;

/**
 * Hält die Kante beim Ziehen in ihren Grenzen. Nach oben ist hart Schluss (das Blatt geht nie
 * über die oberste Lage hinaus), nach unten federt es leicht wie ein Gummiband.
 */
export function clampSheetTop(top: number, min: number, max: number): number {
  'worklet';
  if (top < min) return min;
  if (top > max) return max + (top - max) * 0.25;
  return top;
}

export interface SheetBounds {
  /** Ganz oben: Die Liste füllt alles unter Statusleiste und Zurück-Knopf. */
  min: number;
  /** Beim Öffnen: Karte und Liste teilen sich den Bildschirm. */
  start: number;
  /** Ganz unten: Titel und der obere Rand des ersten Angebots. */
  max: number;
}

/** Grenzen für die obere Kante des Blatts in Punkten vom Bildschirmrand. */
export function sheetBounds(options: {
  screenHeight: number;
  topInset: number;
  bottomInset: number;
  headHeight: number;
  /** Abstand zwischen zwei Angeboten (Trennlinie mit Rand). */
  separatorHeight: number;
}): SheetBounds {
  const min = options.topInset + SHEET_BACK_ZONE;
  const start = Math.round(options.screenHeight * 0.45);
  // Vom ersten Angebot schaut nur noch ein Streifen hervor, so viel wie unten Platz ist.
  const peek = options.headHeight + options.bottomInset + 12 - options.separatorHeight;
  const max = Math.max(start, options.screenHeight - peek);
  return { min, start, max };
}

/** Liegt das Blatt (fast) ganz oben? Dann scrollt die Liste statt das Blatt zu ziehen. */
export function isSheetAtTop(top: number, min: number): boolean {
  'worklet';
  return top <= min + 2;
}
