import { describe, expect, it } from 'vitest';

import {
  favoriteCoverPath,
  sortFavorites,
  summarizeFavoriteOffers,
  type FavoriteOfferInput,
} from './favorite-logic';

function offer(
  id: string,
  locationId: string,
  relevantAt: string,
  freeSeats = 3,
): FavoriteOfferInput {
  return {
    id,
    location_id: locationId,
    relevant_at: relevantAt,
    cover_image_path: `${id}.jpg`,
    free_seats: freeSeats,
  };
}

describe('summarizeFavoriteOffers', () => {
  it('zählt freie Angebote je Ort und nimmt das früheste als nächstes', () => {
    const summary = summarizeFavoriteOffers(
      [
        offer('a2', 'A', '2026-11-16T18:00:00Z'),
        offer('a1', 'A', '2026-11-15T18:00:00Z'),
        offer('b1', 'B', '2026-11-15T10:00:00Z'),
      ],
      ['A', 'B'],
    );
    expect(summary.get('A')?.count).toBe(2);
    expect(summary.get('A')?.next?.id).toBe('a1');
    expect(summary.get('B')?.next?.id).toBe('b1');
  });

  it('ignoriert ausgebuchte Angebote und fremde Orte', () => {
    const summary = summarizeFavoriteOffers(
      [offer('a1', 'A', '2026-11-15T18:00:00Z', 0), offer('x1', 'X', '2026-11-15T18:00:00Z')],
      ['A'],
    );
    expect(summary.get('A')).toEqual({ count: 0, next: null });
    expect(summary.has('X')).toBe(false);
  });
});

describe('favoriteCoverPath', () => {
  it('nimmt zuerst das Galeriefoto, sonst das Angebotsbild', () => {
    expect(favoriteCoverPath(['g.jpg'], { cover_image_path: 'o.jpg' })).toBe('g.jpg');
    expect(favoriteCoverPath([], { cover_image_path: 'o.jpg' })).toBe('o.jpg');
    expect(favoriteCoverPath(['  '], null)).toBeNull();
    expect(favoriteCoverPath(undefined, { cover_image_path: '' })).toBeNull();
  });
});

describe('sortFavorites', () => {
  it('Orte mit Angeboten zuerst nach Termin, dann alphabetisch', () => {
    const locations = [
      { id: 'C', company_name: 'Zander Bar' },
      { id: 'D', company_name: 'Atelier' },
      { id: 'A', company_name: 'Kochschule' },
      { id: 'B', company_name: 'Brauhaus' },
    ];
    const summary = summarizeFavoriteOffers(
      [offer('a1', 'A', '2026-11-16T18:00:00Z'), offer('b1', 'B', '2026-11-15T18:00:00Z')],
      locations.map((location) => location.id),
    );
    expect(sortFavorites(locations, summary).map((location) => location.id)).toEqual([
      'B',
      'A',
      'D',
      'C',
    ]);
  });
});
