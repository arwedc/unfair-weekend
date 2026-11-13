import { describe, expect, it } from 'vitest';

import {
  cityOfOffer,
  nearestCityId,
  countOffersByCity,
  distanceKm,
  getCity,
  isCityId,
  offersInCity,
} from './cities';

const PRINZIPALMARKT = { lat: 51.9625, lng: 7.628 };
const VILNIUS_ALTSTADT = { lat: 54.6811, lng: 25.2873 };
const BERLIN = { lat: 52.52, lng: 13.405 };

describe('distanceKm', () => {
  it('misst die Luftlinie', () => {
    // Münster–Berlin sind gut 390 km Luftlinie.
    const km = distanceKm(getCity('muenster').center, BERLIN);
    expect(km).toBeGreaterThan(380);
    expect(km).toBeLessThan(400);
    expect(distanceKm(PRINZIPALMARKT, PRINZIPALMARKT)).toBe(0);
  });
});

describe('cityOfOffer', () => {
  it('ordnet Angebote der nächstgelegenen Stadt zu', () => {
    expect(cityOfOffer(PRINZIPALMARKT)).toBe('muenster');
    expect(cityOfOffer(VILNIUS_ALTSTADT)).toBe('vilnius');
    expect(cityOfOffer(BERLIN)).toBe('muenster');
  });

  it('zählt Angebote ohne Koordinaten zur Startstadt', () => {
    expect(cityOfOffer({ lat: null, lng: null } as unknown as typeof PRINZIPALMARKT)).toBe(
      'muenster',
    );
  });
});

describe('offersInCity und countOffersByCity', () => {
  const offers = [
    { id: 'a', ...PRINZIPALMARKT },
    { id: 'b', ...VILNIUS_ALTSTADT },
    { id: 'c', ...PRINZIPALMARKT },
  ];

  it('filtert nach Stadt', () => {
    expect(offersInCity(offers, 'muenster').map((o) => o.id)).toEqual(['a', 'c']);
    expect(offersInCity(offers, 'vilnius').map((o) => o.id)).toEqual(['b']);
  });

  it('zählt je Stadt, auch leere', () => {
    expect(countOffersByCity(offers)).toEqual({ muenster: 2, vilnius: 1 });
    expect(countOffersByCity([])).toEqual({ muenster: 0, vilnius: 0 });
  });
});

describe('nearestCityId', () => {
  it('findet die Stadt zum eigenen Standort', () => {
    expect(nearestCityId(PRINZIPALMARKT)).toBe('muenster');
    expect(nearestCityId(VILNIUS_ALTSTADT)).toBe('vilnius');
    // Außerhalb aller Städte: die nächstgelegene
    expect(nearestCityId(BERLIN)).toBe('muenster');
  });
});

describe('isCityId', () => {
  it('prüft gegen die feste Liste', () => {
    expect(isCityId('vilnius')).toBe(true);
    expect(isCityId('berlin')).toBe(false);
    expect(isCityId(null)).toBe(false);
  });
});
