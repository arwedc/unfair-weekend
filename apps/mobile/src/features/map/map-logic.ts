/**
 * Reine Logik für die Karte: welche Angebote als Nadel erscheinen und in welcher
 * Reihenfolge man unten durch die Kacheln wischt. Ohne React, mit Tests.
 */
// Relativ statt '@/…': Vitest kennt den Pfad-Alias nicht, reine Logik soll ohne Extra-Konfiguration testbar bleiben.
import { placeKeyOf } from '../offers/feed-logic';
import type { Offer } from '../offers/types';

/**
 * Angebote für die Karte: nur mit freien Plätzen und mit Koordinaten.
 * Sortiert von West nach Ost, damit Wischen nach rechts zum Angebot rechts daneben führt.
 * Angebote an derselben Adresse stehen direkt hintereinander.
 */
export function mapOffers<T extends Offer>(offers: readonly T[]): T[] {
  return offers
    .filter((offer) => offer.free_seats > 0 && placeKeyOf(offer) !== null)
    .sort((a, b) => a.lng - b.lng || b.lat - a.lat || a.id.localeCompare(b.id));
}

/** Position des ersten Angebots an diesem Ort, oder -1. */
export function firstIndexAtPlace(offers: readonly Offer[], placeKey: string): number {
  return offers.findIndex((offer) => placeKeyOf(offer) === placeKey);
}

/** Wie viele Angebote es am selben Ort gibt (für „2 Angebote hier“). */
export function countAtPlace(offers: readonly Offer[], placeKey: string): number {
  return offers.filter((offer) => placeKeyOf(offer) === placeKey).length;
}

/** Index der Kachel, die nach dem Wischen in der Mitte steht. */
export function snappedIndex(offsetX: number, interval: number, count: number): number {
  if (count === 0 || interval <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offsetX / interval)));
}

/**
 * Endlos wischen: Die Kacheln liegen dreimal hintereinander (Kopie 0, 1, 2), angezeigt wird
 * die mittlere. Eine Position in der Liste heißt hier „virtuell“, das Angebot dahinter „echt“.
 */
export const LOOP_COPIES = 3;

/** Echter Index zu einer virtuellen Position. */
export function realIndex(virtual: number, count: number): number {
  if (count <= 0) return 0;
  return ((virtual % count) + count) % count;
}

/**
 * Virtuelle Position für ein Angebot, möglichst nah an der aktuellen. So scrollt die Liste
 * beim Tipp auf eine Nadel den kurzen Weg (auch über das Ende hinweg).
 */
export function nearestLoopPosition(real: number, currentVirtual: number, count: number): number {
  const candidates = Array.from({ length: LOOP_COPIES }, (_, copy) => copy * count + real);
  return candidates.reduce((best, value) =>
    Math.abs(value - currentVirtual) < Math.abs(best - currentVirtual) ? value : best,
  );
}

/**
 * Nach dem Ausrollen zurück in die mittlere Kopie (ohne Animation, unsichtbar), damit man in
 * beide Richtungen weiterwischen kann. `null`, wenn man schon in der Mitte ist.
 */
export function recenteredPosition(virtual: number, count: number): number | null {
  if (count <= 1) return null;
  if (virtual >= count && virtual < count * 2) return null;
  return count + realIndex(virtual, count);
}
