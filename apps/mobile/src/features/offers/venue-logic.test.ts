import { describe, expect, it } from 'vitest';

import { distinctSubtitle } from './venue-logic';

describe('distinctSubtitle', () => {
  it('blendet einen gleichen Namen aus', () => {
    expect(distinctSubtitle('Kochschule Nord', 'Kochschule Nord')).toBeNull();
    expect(distinctSubtitle('Kochschule Nord', '  kochschule  nord ')).toBeNull();
  });

  it('blendet einen Namen aus, der im anderen steckt', () => {
    expect(
      distinctSubtitle(
        'Lithuanian Theatre, Music and Cinema Museum',
        'Theatre, Music and Cinema Museum',
      ),
    ).toBeNull();
    expect(distinctSubtitle('Café Über', 'cafe uber')).toBeNull();
  });

  it('zeigt einen Standortnamen, der den Firmennamen ergänzt', () => {
    expect(distinctSubtitle('Café Ü', 'Café Ü – Hafen')).toBe('Café Ü – Hafen');
  });

  it('zeigt einen wirklich anderen Standortnamen', () => {
    expect(distinctSubtitle('Kochschule Nord', ' Filiale Hafen ')).toBe('Filiale Hafen');
  });

  it('zeigt nichts ohne Standortnamen', () => {
    expect(distinctSubtitle('Kochschule Nord', '')).toBeNull();
    expect(distinctSubtitle('Kochschule Nord', ' – ')).toBeNull();
  });

  it('zeigt den Standortnamen, wenn der Firmenname fehlt', () => {
    expect(distinctSubtitle('', 'Filiale Hafen')).toBe('Filiale Hafen');
  });
});
