import { describe, expect, it } from 'vitest';

import {
  formatRating,
  ratingWord,
  reviewCountLabel,
  reviewDateLabel,
  starFill,
} from './review-logic';

describe('formatRating', () => {
  it('zeigt eine Nachkommastelle mit Komma', () => {
    expect(formatRating(4.7)).toBe('4,7');
    expect(formatRating(5)).toBe('5,0');
  });
});

describe('reviewCountLabel', () => {
  it('Einzahl und Mehrzahl', () => {
    expect(reviewCountLabel(1)).toBe('1 Bewertung');
    expect(reviewCountLabel(12)).toBe('12 Bewertungen');
  });
});

describe('starFill', () => {
  it('rundet auf halbe Sterne', () => {
    expect([1, 2, 3, 4, 5].map((i) => starFill(3.7, i))).toEqual([
      'full',
      'full',
      'full',
      'half',
      'empty',
    ]);
    expect([1, 2, 3, 4, 5].map((i) => starFill(4.8, i))).toEqual([
      'full',
      'full',
      'full',
      'full',
      'full',
    ]);
  });
});

describe('ratingWord', () => {
  it('gibt zu 1–5 einen Text, sonst null', () => {
    expect(ratingWord(5)).toBe('Großartig!');
    expect(ratingWord(0)).toBeNull();
  });
});

describe('reviewDateLabel', () => {
  // Freitag, 13.11.2026, 12:00 Uhr in Berlin
  const NOW = '2026-11-13T11:00:00Z';

  it('nennt Tage, Wochen, Monate und Jahre', () => {
    expect(reviewDateLabel('2026-11-13T08:00:00Z', NOW)).toBe('Heute');
    // 23:30 Uhr Berliner Zeit am Vortag
    expect(reviewDateLabel('2026-11-12T22:30:00Z', NOW)).toBe('Gestern');
    expect(reviewDateLabel('2026-11-10T10:00:00Z', NOW)).toBe('vor 3 Tagen');
    expect(reviewDateLabel('2026-10-30T10:00:00Z', NOW)).toBe('vor 2 Wochen');
    expect(reviewDateLabel('2026-10-10T10:00:00Z', NOW)).toBe('vor 1 Monat');
    expect(reviewDateLabel('2025-11-01T10:00:00Z', NOW)).toBe('vor 1 Jahr');
  });
});
