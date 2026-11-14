/**
 * Daten fürs Onboarding: welche echten Angebote als Pins und im Angebotskreis erscheinen
 * und wo die Pins auf der gezeichneten Stadtkarte liegen. Ohne React, mit Tests.
 */
import type { Offer } from '@/features/offers/types';

/** So viele Pins und Karten zeigt das Onboarding höchstens. */
export const MAX_SHOWCASE_OFFERS = 5;

/** Die Typen sagen string, in der DB kann das Foto aber fehlen. */
interface ShowcaseOffer {
  id: string;
  company_id: string;
  cover_image_path: string | null;
}
type Located = Pick<Offer, 'lat' | 'lng'>;

/** Punkt auf der Karte, 0 bis 1 in Breite und Höhe. */
export interface PinPoint {
  x: number;
  y: number;
}

/** Angebote mit Foto zuerst, sonst Reihenfolge wie im Feed. */
function withImageFirst<T extends ShowcaseOffer>(offers: readonly T[]): T[] {
  return [
    ...offers.filter((offer) => Boolean(offer.cover_image_path)),
    ...offers.filter((offer) => !offer.cover_image_path),
  ];
}

/** Ein Pin pro Unternehmen, Angebote mit Foto bevorzugt. */
export function pinOffers<T extends ShowcaseOffer>(
  offers: readonly T[],
  max: number = MAX_SHOWCASE_OFFERS,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const offer of withImageFirst(offers)) {
    if (result.length >= max) break;
    if (seen.has(offer.company_id)) continue;
    seen.add(offer.company_id);
    result.push(offer);
  }
  return result;
}

/**
 * Karten für den Angebotskreis: das gewählte Angebot vorne, dann möglichst andere
 * Unternehmen, danach weitere Angebote, bis der Kreis voll ist.
 */
export function wheelOffers<T extends ShowcaseOffer>(
  selected: T | undefined,
  offers: readonly T[],
  max: number = MAX_SHOWCASE_OFFERS,
): T[] {
  if (!selected) return [];
  const rest = offers.filter((offer) => offer.id !== selected.id);
  const otherCompanies = pinOffers(
    rest.filter((offer) => offer.company_id !== selected.company_id),
    max - 1,
  );
  const picked = new Set(otherCompanies.map((offer) => offer.id));
  const fill = withImageFirst(rest.filter((offer) => !picked.has(offer.id)));
  return [selected, ...otherCompanies, ...fill].slice(0, max);
}

/** Feste Plätze, wenn Koordinaten fehlen: lockerer Bogen über die Karte. */
export const FALLBACK_PIN_POINTS: readonly PinPoint[] = [
  { x: 0.5, y: 0.3 },
  { x: 0.24, y: 0.5 },
  { x: 0.76, y: 0.46 },
  { x: 0.36, y: 0.78 },
  { x: 0.68, y: 0.76 },
];

export interface PinLayoutOptions {
  /** Breite durch Höhe der Karte. */
  aspect: number;
  /** Rand, den die Pins frei lassen (Anteil der Höhe). Oben mehr, weil der Pin nach oben ragt. */
  padTop?: number;
  padBottom?: number;
  padX?: number;
  /** Mindestabstand zwischen zwei Pins (Anteil der Höhe). */
  minDistance?: number;
}

function validPoint(point: Located | null | undefined): { lat: number; lng: number } | null {
  if (!point) return null;
  // Die Typen sagen number, in der DB können die Koordinaten aber fehlen.
  const lat = point.lat as number | null;
  const lng = point.lng as number | null;
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Verteilt die Pins nach ihren echten Koordinaten auf die Karte: Norden oben, gleicher
 * Maßstab in beide Richtungen, mittig eingepasst. Pins, die zu dicht liegen, werden
 * auseinandergeschoben, damit jeder antippbar bleibt.
 */
export function layoutPins(
  points: readonly (Located | null | undefined)[],
  options: PinLayoutOptions,
): PinPoint[] {
  const { aspect } = options;
  const padTop = options.padTop ?? 0.24;
  const padBottom = options.padBottom ?? 0.1;
  const padX = options.padX ?? 0.12;
  const minDistance = options.minDistance ?? 0.2;
  if (points.length === 0) return [];

  const valid = points.map(validPoint);
  const located = valid.filter((point): point is { lat: number; lng: number } => point !== null);

  // Arbeitsraum: x von 0 bis aspect, y von 0 bis 1 (gleiche Einheit wie die Höhe).
  const minX = padX * aspect;
  const maxX = aspect - padX * aspect;
  const minY = padTop;
  const maxY = 1 - padBottom;

  let placed: { x: number; y: number }[];
  if (located.length < 2) {
    placed = points.map((_, index) => {
      const fallback = FALLBACK_PIN_POINTS[index % FALLBACK_PIN_POINTS.length] ?? {
        x: 0.5,
        y: 0.5,
      };
      return { x: fallback.x * aspect, y: minY + fallback.y * (maxY - minY) };
    });
  } else {
    const meanLat = located.reduce((sum, point) => sum + point.lat, 0) / located.length;
    const lngFactor = Math.cos((meanLat * Math.PI) / 180);
    const projected = located.map((point) => ({ x: point.lng * lngFactor, y: -point.lat }));
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const scaleX = spanX > 0 ? (maxX - minX) / spanX : Infinity;
    const scaleY = spanY > 0 ? (maxY - minY) / spanY : Infinity;
    const scale = Math.min(scaleX, scaleY);
    const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    let fallbackIndex = 0;
    placed = valid.map((point) => {
      if (!point) {
        const fallback = FALLBACK_PIN_POINTS[fallbackIndex++ % FALLBACK_PIN_POINTS.length] ?? {
          x: 0.5,
          y: 0.5,
        };
        return { x: fallback.x * aspect, y: minY + fallback.y * (maxY - minY) };
      }
      const x = point.lng * lngFactor;
      const y = -point.lat;
      return Number.isFinite(scale)
        ? { x: centerX + (x - midX) * scale, y: centerY + (y - midY) * scale }
        : { x: centerX, y: centerY };
    });
  }

  relax(placed, { minX, maxX, minY, maxY, minDistance });
  return placed.map((point) => ({ x: point.x / aspect, y: point.y }));
}

/** Schiebt zu dicht liegende Punkte auseinander und hält sie im Rahmen. */
function relax(
  points: { x: number; y: number }[],
  box: { minX: number; maxX: number; minY: number; maxY: number; minDistance: number },
): void {
  const { minX, maxX, minY, maxY, minDistance } = box;
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 1e-6) {
          // Gleiche Adresse: in eine feste, je Paar andere Richtung schieben.
          const angle = (i * 2.399 + j * 1.13) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistance - Math.hypot(b.x - a.x, b.y - a.y)) / 2 + 1e-4;
        const ux = dx / distance;
        const uy = dy / distance;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    for (const point of points) {
      point.x = Math.min(maxX, Math.max(minX, point.x));
      point.y = Math.min(maxY, Math.max(minY, point.y));
    }
    if (!moved) break;
  }
}

/** Winkel zwischen zwei Karten im Kreis. */
export function stepAngle(count: number): number {
  'worklet';
  return count > 0 ? 360 / count : 360;
}

/** Index der Karte, die bei dieser Drehung vorne steht. */
export function frontIndex(rotation: number, count: number): number {
  'worklet';
  if (count <= 0) return 0;
  const raw = Math.round(-rotation / stepAngle(count));
  return ((raw % count) + count) % count;
}

/** Nächste Raststellung, optional mit Schwung (Grad pro Sekunde) und Obergrenze. */
export function snapRotation(
  rotation: number,
  count: number,
  velocity: number = 0,
  projectSeconds: number = 0.2,
  maxTravel: number = 720,
): number {
  'worklet';
  const step = stepAngle(count);
  const travel = Math.max(-maxTravel, Math.min(maxTravel, velocity * projectSeconds));
  return Math.round((rotation + travel) / step) * step;
}

/** Nächste volle Umdrehung, bei der Karte 0 wieder vorne steht. */
export function nearestTurn(rotation: number): number {
  'worklet';
  return Math.round(rotation / 360) * 360;
}

/** Winkel auf -180 bis 180 Grad. */
export function normalizeAngle(degrees: number): number {
  'worklet';
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}
