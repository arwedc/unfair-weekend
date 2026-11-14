/**
 * Reine Logik für das ziehbare Blatt über der Karte (Abschnitts-Seite).
 * Läuft auch als Worklet auf dem UI-Thread, deshalb ohne Imports und mit 'worklet'.
 */

/** Stufen des Blatts: groß (ganze Liste), mittel, klein (nur das oberste Angebot). */
export const SHEET_EXPANDED = 0;
export const SHEET_MIDDLE = 1;
export const SHEET_COLLAPSED = 2;

/** Wie weit ein schneller Wurf das Ziel nach vorne schiebt (Sekunden Schwung). */
const FLING_PROJECTION_S = 0.18;

/**
 * Wählt die Stufe, zu der das Blatt nach dem Loslassen springt.
 * `snaps` sind die oberen Kanten der Stufen (aufsteigend: groß, mittel, klein), `top` die
 * aktuelle Kante, `velocity` die Geschwindigkeit nach unten in Punkten pro Sekunde.
 */
export function pickSnap(top: number, velocity: number, snaps: readonly number[]): number {
  'worklet';
  const projected = top + velocity * FLING_PROJECTION_S;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < snaps.length; index += 1) {
    const snap = snaps[index] ?? 0;
    const distance = Math.abs(snap - projected);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

/** Hält die Kante beim Ziehen zwischen größter und kleinster Stufe, mit etwas Gummiband. */
export function clampSheetTop(top: number, min: number, max: number): number {
  'worklet';
  if (top < min) return min - (min - top) * 0.25;
  if (top > max) return max + (top - max) * 0.25;
  return top;
}

/**
 * Obere Kanten der drei Stufen. Klein zeigt Griff, Titel und genau ein Angebot,
 * mittel teilt den Bildschirm, groß lässt oben Platz für den Zurück-Knopf.
 */
export function sheetSnaps(options: {
  screenHeight: number;
  topInset: number;
  bottomInset: number;
  headHeight: number;
  rowHeight: number;
}): [number, number, number] {
  const expanded = options.topInset + 64;
  const middle = Math.round(options.screenHeight * 0.45);
  const peek = options.headHeight + options.rowHeight + options.bottomInset + 12;
  // Klein liegt immer deutlich unter mittel, auch auf kleinen Bildschirmen.
  const collapsed = Math.max(middle + 80, options.screenHeight - peek);
  return [expanded, middle, collapsed];
}
