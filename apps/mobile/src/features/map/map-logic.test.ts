import { describe, expect, it } from 'vitest';

import type { Offer } from '@/features/offers/types';

import {
  citySummaries,
  countAtPlace,
  firstIndexAtPlace,
  mapOffers,
  nearestLoopPosition,
  realIndex,
  recenteredPosition,
  sameCityOffers,
  snappedIndex,
} from './map-logic';

const offer = (id: string, lng: number, lat: number, free_seats = 3): Offer =>
  ({ id, lng, lat, free_seats }) as Offer;

describe('mapOffers', () => {
  it('sortiert von West nach Ost', () => {
    const result = mapOffers([offer('ost', 7.64, 51.96), offer('west', 7.6, 51.96)]);
    expect(result.map((o) => o.id)).toEqual(['west', 'ost']);
  });

  it('lässt ausgebuchte Angebote weg', () => {
    const result = mapOffers([offer('voll', 7.6, 51.96, 0), offer('frei', 7.62, 51.96)]);
    expect(result.map((o) => o.id)).toEqual(['frei']);
  });

  it('lässt Angebote ohne Koordinaten weg', () => {
    const ohne = { ...offer('ohne', 0, 0), lat: null, lng: null } as unknown as Offer;
    expect(mapOffers([ohne, offer('mit', 7.6, 51.96)]).map((o) => o.id)).toEqual(['mit']);
  });

  it('hält Angebote am selben Ort zusammen und ändert die Eingabe nicht', () => {
    const input = [offer('b', 7.62, 51.96), offer('x', 7.61, 51.95), offer('a', 7.62, 51.96)];
    expect(mapOffers(input).map((o) => o.id)).toEqual(['x', 'a', 'b']);
    expect(input.map((o) => o.id)).toEqual(['b', 'x', 'a']);
  });
});

describe('firstIndexAtPlace / countAtPlace', () => {
  const list = mapOffers([
    offer('a', 7.6, 51.96),
    offer('b', 7.62, 51.96),
    offer('c', 7.62, 51.96),
  ]);

  it('findet das erste Angebot am Ort', () => {
    expect(firstIndexAtPlace(list, '51.96000,7.62000')).toBe(1);
    expect(firstIndexAtPlace(list, 'gibt-es-nicht')).toBe(-1);
  });

  it('zählt die Angebote am Ort', () => {
    expect(countAtPlace(list, '51.96000,7.62000')).toBe(2);
    expect(countAtPlace(list, '51.96000,7.60000')).toBe(1);
  });
});

describe('snappedIndex', () => {
  it('rundet auf die nächste Kachel und bleibt im Bereich', () => {
    expect(snappedIndex(0, 300, 5)).toBe(0);
    expect(snappedIndex(460, 300, 5)).toBe(2);
    expect(snappedIndex(-50, 300, 5)).toBe(0);
    expect(snappedIndex(9999, 300, 5)).toBe(4);
    expect(snappedIndex(100, 300, 0)).toBe(0);
  });
});

describe('Endlos-Wischen', () => {
  it('rechnet virtuelle Positionen auf echte Angebote um', () => {
    expect(realIndex(0, 3)).toBe(0);
    expect(realIndex(4, 3)).toBe(1);
    expect(realIndex(8, 3)).toBe(2);
    expect(realIndex(-1, 3)).toBe(2);
  });

  it('nimmt beim Tipp auf eine Nadel den kurzen Weg, auch über das Ende', () => {
    // 4 Angebote, man steht auf dem letzten (virtuell 7): zum ersten geht es vorwärts (8).
    expect(nearestLoopPosition(0, 7, 4)).toBe(8);
    expect(nearestLoopPosition(2, 5, 4)).toBe(6);
  });

  it('springt nach dem Ausrollen in die mittlere Kopie zurück', () => {
    // Vom letzten Angebot nach rechts gewischt: virtuell 8 = Angebot 0 → Mitte 4.
    expect(recenteredPosition(8, 4)).toBe(4);
    expect(recenteredPosition(3, 4)).toBe(7);
    expect(recenteredPosition(5, 4)).toBeNull();
    expect(recenteredPosition(0, 1)).toBeNull();
  });
});

describe('citySummaries', () => {
  it('zählt je Stadt und setzt den Punkt in die Stadtmitte', () => {
    const offers = [offer('m1', 7.62, 51.96), offer('m2', 7.64, 51.95), offer('v1', 25.28, 54.68)];
    const summaries = citySummaries(offers);
    expect(summaries.map((city) => [city.id, city.count])).toEqual([
      ['muenster', 2],
      ['vilnius', 1],
    ]);
    expect(summaries[0]?.lat).toBeCloseTo(51.9607);
  });

  it('lässt Städte ohne Angebot weg', () => {
    expect(citySummaries([offer('m1', 7.62, 51.96)]).map((city) => city.id)).toEqual(['muenster']);
    expect(citySummaries([])).toEqual([]);
  });
});

describe('sameCityOffers', () => {
  it('wischt nur durch die Angebote derselben Stadt', () => {
    const m1 = offer('m1', 7.62, 51.96);
    const v1 = offer('v1', 25.28, 54.68);
    const m2 = offer('m2', 7.64, 51.95);
    expect(sameCityOffers([m1, v1, m2], m2).map((o) => o.id)).toEqual(['m1', 'm2']);
    expect(sameCityOffers([m1, v1, m2], v1).map((o) => o.id)).toEqual(['v1']);
    expect(sameCityOffers([m1], undefined)).toEqual([]);
  });
});
