import { describe, expect, it } from 'vitest';

import {
  FALLBACK_PIN_POINTS,
  frontIndex,
  layoutPins,
  nearestTurn,
  normalizeAngle,
  pinOffers,
  snapRotation,
  wheelOffers,
} from './onboarding-logic';

function offer(id: string, company: string, image: string | null = `${id}.jpg`) {
  return { id, company_id: company, cover_image_path: image };
}

describe('pinOffers', () => {
  it('nimmt pro Unternehmen ein Angebot und höchstens fünf', () => {
    const offers = [
      offer('a1', 'a'),
      offer('a2', 'a'),
      offer('b1', 'b'),
      offer('c1', 'c'),
      offer('d1', 'd'),
      offer('e1', 'e'),
      offer('f1', 'f'),
    ];
    expect(pinOffers(offers).map((o) => o.id)).toEqual(['a1', 'b1', 'c1', 'd1', 'e1']);
  });

  it('bevorzugt Angebote mit Foto, auch innerhalb eines Unternehmens', () => {
    const offers = [offer('a1', 'a', null), offer('b1', 'b', null), offer('a2', 'a')];
    expect(pinOffers(offers).map((o) => o.id)).toEqual(['a2', 'b1']);
  });
});

describe('wheelOffers', () => {
  it('stellt das gewählte Angebot nach vorne und füllt mit anderen Unternehmen auf', () => {
    const offers = [offer('a1', 'a'), offer('a2', 'a'), offer('b1', 'b'), offer('c1', 'c')];
    const selected = offers[2];
    expect(wheelOffers(selected, offers).map((o) => o.id)).toEqual(['b1', 'a1', 'c1', 'a2']);
  });

  it('bleibt bei höchstens fünf Karten', () => {
    const offers = Array.from({ length: 9 }, (_, i) => offer(`o${i}`, `c${i}`));
    expect(wheelOffers(offers[4], offers)).toHaveLength(5);
    expect(wheelOffers(offers[4], offers)[0]?.id).toBe('o4');
  });

  it('ist ohne Auswahl leer', () => {
    expect(wheelOffers(undefined, [offer('a1', 'a')])).toEqual([]);
  });
});

describe('layoutPins', () => {
  const options = { aspect: 1.2, padTop: 0.2, padBottom: 0.1, padX: 0.1, minDistance: 0.2 };

  it('legt Norden nach oben und Osten nach rechts', () => {
    const [west, east] = layoutPins(
      [
        { lat: 51.95, lng: 7.6 },
        { lat: 51.97, lng: 7.65 },
      ],
      options,
    );
    expect(west && east).toBeTruthy();
    expect(east!.x).toBeGreaterThan(west!.x);
    expect(east!.y).toBeLessThan(west!.y);
  });

  it('bleibt im Rahmen und hält Abstand, auch bei gleicher Adresse', () => {
    const same = { lat: 51.96, lng: 7.62 };
    const points = layoutPins([same, same, same, { lat: 51.9, lng: 7.7 }], options);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(point.x).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(point.y).toBeGreaterThanOrEqual(0.2 - 1e-9);
      expect(point.y).toBeLessThanOrEqual(0.9 + 1e-9);
    }
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!;
        const b = points[j]!;
        const distance = Math.hypot((a.x - b.x) * options.aspect, a.y - b.y);
        expect(distance).toBeGreaterThan(0.19);
      }
    }
  });

  it('nutzt feste Plätze, wenn Koordinaten fehlen', () => {
    const points = layoutPins([null, null], options);
    expect(points).toHaveLength(2);
    expect(points[0]!.x).toBeCloseTo(FALLBACK_PIN_POINTS[0]!.x);
  });

  it('gibt für keine Punkte nichts zurück', () => {
    expect(layoutPins([], options)).toEqual([]);
  });
});

describe('Drehung des Angebotskreises', () => {
  it('findet die vordere Karte', () => {
    expect(frontIndex(0, 5)).toBe(0);
    expect(frontIndex(-72, 5)).toBe(1);
    expect(frontIndex(72, 5)).toBe(4);
    expect(frontIndex(-1080, 5)).toBe(0);
    expect(frontIndex(-100, 5)).toBe(1);
  });

  it('rastet auf die nächste Karte ein und rechnet Schwung mit', () => {
    expect(snapRotation(-30, 5)).toBe(-0);
    expect(snapRotation(-40, 5)).toBe(-72);
    expect(snapRotation(0, 5, -1000)).toBe(-216);
    expect(snapRotation(0, 5, -100000)).toBe(-720);
  });

  it('dreht zurück auf eine volle Umdrehung', () => {
    expect(nearestTurn(-1000)).toBe(-1080);
    expect(nearestTurn(170)).toBe(0);
  });

  it('normalisiert Winkel auf -180 bis 180', () => {
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-190)).toBe(170);
    expect(normalizeAngle(720)).toBe(0);
  });
});
