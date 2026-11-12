import { describe, expect, it } from 'vitest';
import { isFewSeatsLeft, seatsLabel } from './seats';

describe('seatsLabel', () => {
  it('beschreibt freie Plätze', () => {
    expect(seatsLabel(0)).toBe('Ausgebucht');
    expect(seatsLabel(1)).toBe('Nur noch 1 Platz');
    expect(seatsLabel(3)).toBe('Nur noch 3 Plätze');
    expect(seatsLabel(8)).toBe('8 Plätze frei');
  });

  it('lehnt ungültige Werte ab', () => {
    expect(() => seatsLabel(-1)).toThrow(RangeError);
    expect(() => seatsLabel(1.5)).toThrow(RangeError);
  });
});

describe('isFewSeatsLeft', () => {
  it('ist nur bei 1–3 freien Plätzen wahr', () => {
    expect(isFewSeatsLeft(0)).toBe(false);
    expect(isFewSeatsLeft(1)).toBe(true);
    expect(isFewSeatsLeft(3)).toBe(true);
    expect(isFewSeatsLeft(4)).toBe(false);
  });
});
