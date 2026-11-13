/**
 * Symbole in den Kartennadeln: ein festes Symbol pro Kategorie, dieselben wie auf den
 * Kategorie-Chips (`components/offers/category-icons.ts`). Die Karte läuft in einer WebView
 * und kann keine React-Komponenten zeichnen, deshalb stehen hier die Zeichenpfade selbst.
 *
 * Pfade aus Lucide (ISC-Lizenz), 24×24-Raster, als Linie gezeichnet. Kreise und Rechtecke
 * sind in Pfade umgerechnet, damit die Karte nur `Path2D` braucht.
 * Ändert sich ein Symbol in category-icons.ts, hier den passenden Pfad mitziehen.
 */
import { OFFER_CATEGORIES, type OfferCategory } from '@repo/shared';

import type { OfferPlace } from '../offers/feed-logic';

/** Kreis als Pfad (zwei Halbbögen). */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

export const PIN_ICON_PATHS = {
  // ChefHat
  kochen_essen: [
    'M10 11v5',
    'M14 11v5',
    'M6 12.65c0-.457-.316-.844-.727-1.041A4 4 0 017.52 4.034a1.53 1.53 0 001.367-.547 4 4 0 016.225 0 1.53 1.53 0 001.367.547 4 4 0 012.248 7.575c-.411.197-.727.584-.727 1.04V19a2 2 0 01-2 2H8a2 2 0 01-2-2z',
    'M6 16h12',
  ],
  // Dumbbell
  sport_bewegung: [
    'M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z',
    'm2.5 21.5 1.4-1.4',
    'm20.1 3.9 1.4-1.4',
    'M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z',
    'm9.6 14.4 4.8-4.8',
  ],
  // Palette
  kreativ_workshops: [
    'M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z',
    circle(13.5, 6.5, 0.5),
    circle(17.5, 10.5, 0.5),
    circle(6.5, 12.5, 0.5),
    circle(8.5, 7.5, 0.5),
  ],
  // Sparkles
  wellness_beauty: [
    'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
    'M20 2v4',
    'M22 4h-4',
    circle(4, 20, 2),
  ],
  // Drama
  kultur_events: [
    'M10 11h.01',
    'M14 6h.01',
    'M18 6h.01',
    'M6.5 13.1h.01',
    'M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3',
    'M17.4 9.9c-.8.8-2 .8-2.8 0',
    'M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7',
    'M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4',
  ],
  // Shapes
  sonstiges: [
    'M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z',
    'M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z',
    circle(17.5, 17.5, 3.5),
  ],
} as const satisfies Record<OfferCategory, readonly string[]>;

/**
 * Kategorie einer Nadel. Liegen an einer Adresse mehrere Angebote, gewinnt die häufigste
 * Kategorie, bei Gleichstand die des ersten Angebots.
 */
export function placeCategory(place: Pick<OfferPlace, 'offers'>): OfferCategory {
  const counts = new Map<OfferCategory, number>();
  let best: OfferCategory | null = null;
  for (const offer of place.offers) {
    const next = (counts.get(offer.category) ?? 0) + 1;
    counts.set(offer.category, next);
    if (best === null || next > (counts.get(best) ?? 0)) best = offer.category;
  }
  return best !== null && OFFER_CATEGORIES.includes(best) ? best : 'sonstiges';
}
