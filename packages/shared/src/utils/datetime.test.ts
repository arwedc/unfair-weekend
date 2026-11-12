import { describe, expect, it } from 'vitest';
import {
  berlinDateKey,
  berlinParts,
  calendarDaysBetween,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatTime,
  formatTimeRange,
  toDate,
} from './datetime';

// Do., 12.11.2026, 11:00 Uhr in Berlin (MEZ, UTC+1)
const NOW = '2026-11-12T10:00:00Z';

describe('berlinParts / formatTime', () => {
  it('rechnet Winterzeit (UTC+1) um', () => {
    expect(formatTime('2026-11-14T17:00:00Z')).toBe('18:00');
  });

  it('rechnet Sommerzeit (UTC+2) um', () => {
    expect(formatTime('2026-07-14T16:00:00Z')).toBe('18:00');
  });

  it('zeigt Mitternacht als 00:00, nie als 24:00', () => {
    expect(formatTime('2026-11-12T23:00:00Z')).toBe('00:00');
  });

  it('berücksichtigt die Zeitumstellung im März', () => {
    // 29.03.2026: 02:00 MEZ → 03:00 MESZ (01:00 UTC)
    expect(formatTime('2026-03-29T00:30:00Z')).toBe('01:30');
    expect(formatTime('2026-03-29T01:30:00Z')).toBe('03:30');
  });

  it('liefert den Berliner Wochentag', () => {
    expect(berlinParts('2026-11-14T17:00:00Z').weekday).toBe(6); // Samstag
    // 23:30 UTC am Samstag ist in Berlin schon Sonntag
    expect(berlinParts('2026-11-14T23:30:00Z').weekday).toBe(0);
  });

  it('liefert den Berliner Kalendertag', () => {
    expect(berlinDateKey('2026-11-12T23:30:00Z')).toBe('2026-11-13');
  });
});

describe('calendarDaysBetween', () => {
  it('zählt Kalendertage in Berlin, nicht 24-Stunden-Blöcke', () => {
    // 23:59 → 00:30 am Folgetag = 1 Tag, obwohl nur 31 Minuten
    expect(calendarDaysBetween('2026-11-12T22:59:00Z', '2026-11-12T23:30:00Z')).toBe(1);
    expect(calendarDaysBetween(NOW, NOW)).toBe(0);
    expect(calendarDaysBetween('2026-11-14T10:00:00Z', NOW)).toBe(-2);
  });

  it('bleibt über die Zeitumstellung im Oktober korrekt', () => {
    // Sa. 24.10. 22:00 MESZ → Mo. 26.10. 00:30 MEZ
    expect(calendarDaysBetween('2026-10-24T20:00:00Z', '2026-10-25T23:30:00Z')).toBe(2);
  });
});

describe('formatDate', () => {
  it('formatiert mit Wochentag und ohne Jahr', () => {
    expect(formatDate('2026-11-14T17:00:00Z')).toBe('Sa., 14.11.');
  });

  it('kann Wochentag weglassen und Jahr anfügen', () => {
    expect(formatDate('2026-11-14T17:00:00Z', { withWeekday: false, withYear: true })).toBe(
      '14.11.2026',
    );
  });
});

describe('formatDateTime', () => {
  it('nennt heute und morgen beim Namen', () => {
    expect(formatDateTime('2026-11-12T17:00:00Z', NOW)).toBe('heute, 18:00');
    expect(formatDateTime('2026-11-13T17:00:00Z', NOW)).toBe('morgen, 18:00');
    expect(formatDateTime('2026-11-11T17:00:00Z', NOW)).toBe('gestern, 18:00');
  });

  it('zeigt sonst Wochentag und Datum', () => {
    expect(formatDateTime('2026-11-14T17:00:00Z', NOW)).toBe('Sa., 14.11., 18:00');
  });

  it('zeigt das Jahr, wenn es nicht das aktuelle ist', () => {
    expect(formatDateTime('2027-01-08T17:00:00Z', NOW)).toBe('Fr., 08.01.2027, 18:00');
  });

  it('wechselt um Mitternacht in Berlin den Tag', () => {
    expect(formatDateTime('2026-11-12T23:30:00Z', '2026-11-12T22:59:00Z')).toBe('morgen, 00:30');
    expect(formatDateTime('2026-11-12T23:50:00Z', '2026-11-12T23:10:00Z')).toBe('heute, 00:50');
  });

  it('bleibt über die Zeitumstellung im Oktober korrekt', () => {
    const now = '2026-10-24T20:00:00Z'; // Sa. 22:00 MESZ
    expect(formatDateTime('2026-10-25T17:00:00Z', now)).toBe('morgen, 18:00');
    expect(formatDateTime('2026-10-25T23:30:00Z', now)).toBe('Mo., 26.10., 00:30');
  });
});

describe('formatTimeRange', () => {
  it('fasst Termine am selben Tag zusammen', () => {
    expect(formatTimeRange('2026-11-12T17:00:00Z', '2026-11-12T20:00:00Z', NOW)).toBe(
      'heute, 18:00–21:00',
    );
  });

  it('schreibt Termine über Mitternacht aus', () => {
    expect(formatTimeRange('2026-11-14T21:00:00Z', '2026-11-15T01:00:00Z', NOW)).toBe(
      'Sa., 14.11., 22:00 – So., 15.11., 02:00',
    );
  });
});

describe('formatDateRange', () => {
  it('zeigt Zeiträume ohne Uhrzeit', () => {
    expect(formatDateRange('2026-11-14T09:00:00Z', '2026-11-20T21:00:00Z', NOW)).toBe(
      '14.11. – 20.11.',
    );
  });

  it('zeigt Jahre bei Zeiträumen über den Jahreswechsel', () => {
    expect(formatDateRange('2026-12-28T09:00:00Z', '2027-01-03T21:00:00Z', NOW)).toBe(
      '28.12.2026 – 03.01.2027',
    );
  });

  it('zeigt einen einzelnen Tag nur einmal', () => {
    expect(formatDateRange('2026-11-14T09:00:00Z', '2026-11-14T18:00:00Z', NOW)).toBe('14.11.');
  });
});

describe('toDate', () => {
  it('akzeptiert Date, ISO-String und Millisekunden', () => {
    const ms = Date.parse(NOW);
    expect(toDate(NOW).getTime()).toBe(ms);
    expect(toDate(ms).getTime()).toBe(ms);
    expect(toDate(new Date(ms)).getTime()).toBe(ms);
  });

  it('wirft bei ungültigen Werten', () => {
    expect(() => toDate('kein Datum')).toThrow(RangeError);
  });
});
