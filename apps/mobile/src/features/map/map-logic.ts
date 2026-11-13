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
