import { describe, expect, it } from 'vitest';

import type { Offer } from '@/features/offers/types';

import { countAtPlace, firstIndexAtPlace, mapOffers, snappedIndex } from './map-logic';

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
