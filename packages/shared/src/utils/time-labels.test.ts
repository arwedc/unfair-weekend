import { describe, expect, it } from 'vitest';
import { offerTimeLabel, relativeDistance, relevantAt } from './time-labels';

// Do., 12.11.2026, 11:00 Uhr in Berlin
const NOW = '2026-11-12T10:00:00Z';

describe('relativeDistance', () => {
  it('zählt unter einer Stunde in Minuten (aufgerundet, mindestens 1)', () => {
    expect(relativeDistance('2026-11-12T10:45:00Z', NOW)).toBe('in 45 Min.');
    expect(relativeDistance('2026-11-12T10:00:20Z', NOW)).toBe('in 1 Min.');
    expect(relativeDistance('2026-11-12T10:59:00Z', NOW)).toBe('in 59 Min.');
    // 59,5 Min. würden auf 60 aufgerundet, dann lieber „1 Std.“
    expect(relativeDistance('2026-11-12T10:59:30Z', NOW)).toBe('in 1 Std.');
  });

  it('zählt unter 24 Stunden in ganzen Stunden (abgerundet)', () => {
    expect(relativeDistance('2026-11-12T11:00:00Z', NOW)).toBe('in 1 Std.');
    expect(relativeDistance('2026-11-12T12:30:00Z', NOW)).toBe('in 2 Std.');
    expect(relativeDistance('2026-11-13T09:59:00Z', NOW)).toBe('in 23 Std.');
  });

  it('zählt ab 24 Stunden in Berliner Kalendertagen', () => {
    expect(relativeDistance('2026-11-13T17:00:00Z', NOW)).toBe('morgen');
    expect(relativeDistance('2026-11-15T17:00:00Z', NOW)).toBe('in 3 Tagen');
  });
});

describe('offerTimeLabel – Einzeltermin', () => {
  const at = (startsAt: string, endsAt: string) =>
    offerTimeLabel({ type: 'einzeltermin', startsAt, endsAt }, NOW);

  it('zeigt „startet in …“ vor Beginn und markiert < 3 Std. als dringend', () => {
    expect(at('2026-11-12T12:00:00Z', '2026-11-12T15:00:00Z')).toEqual({
      text: 'startet in 2 Std.',
      phase: 'bevorstehend',
      urgent: true,
    });
    expect(at('2026-11-12T10:45:00Z', '2026-11-12T12:00:00Z').text).toBe('startet in 45 Min.');
    expect(at('2026-11-12T22:00:00Z', '2026-11-12T23:00:00Z')).toMatchObject({
      text: 'startet in 12 Std.',
      urgent: false,
    });
    expect(at('2026-11-13T17:00:00Z', '2026-11-13T20:00:00Z').text).toBe('startet morgen');
    expect(at('2026-11-15T17:00:00Z', '2026-11-15T20:00:00Z').text).toBe('startet in 3 Tagen');
  });

  it('zeigt „läuft gerade“ zwischen Beginn und Ende (Beginn inklusive)', () => {
    expect(at('2026-11-12T09:00:00Z', '2026-11-12T12:00:00Z')).toEqual({
      text: 'läuft gerade',
      phase: 'laeuft',
      urgent: false,
    });
    expect(at(NOW, '2026-11-12T12:00:00Z').phase).toBe('laeuft');
  });

  it('zeigt „beendet“ ab dem Ende', () => {
    expect(at('2026-11-12T07:00:00Z', NOW)).toEqual({
      text: 'beendet',
      phase: 'beendet',
      urgent: false,
    });
  });
});

describe('offerTimeLabel – Zeitraum', () => {
  const at = (startsAt: string, endsAt: string) =>
    offerTimeLabel({ type: 'zeitraum', startsAt, endsAt }, NOW);

  it('zeigt „startet in …“ vor Beginn des Zeitraums', () => {
    expect(at('2026-11-13T17:00:00Z', '2026-11-20T22:00:00Z').text).toBe('startet morgen');
  });

  it('zeigt „endet in …“ während des Zeitraums', () => {
    expect(at('2026-11-10T08:00:00Z', '2026-11-16T22:59:00Z')).toEqual({
      text: 'endet in 4 Tagen',
      phase: 'laeuft',
      urgent: false,
    });
    expect(at('2026-11-10T08:00:00Z', '2026-11-12T11:30:00Z')).toEqual({
      text: 'endet in 1 Std.',
      phase: 'laeuft',
      urgent: true,
    });
  });

  it('zeigt „beendet“ nach dem Zeitraum', () => {
    expect(at('2026-11-01T08:00:00Z', '2026-11-11T22:00:00Z').text).toBe('beendet');
  });
});

describe('relevantAt', () => {
  it('nutzt beim Einzeltermin den Beginn und beim Zeitraum das Ende', () => {
    const startsAt = '2026-11-13T17:00:00Z';
    const endsAt = '2026-11-20T22:00:00Z';
    expect(relevantAt({ type: 'einzeltermin', startsAt, endsAt }).toISOString()).toBe(
      '2026-11-13T17:00:00.000Z',
    );
    expect(relevantAt({ type: 'zeitraum', startsAt, endsAt }).toISOString()).toBe(
      '2026-11-20T22:00:00.000Z',
    );
  });
});
