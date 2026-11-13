import { describe, expect, it } from 'vitest';
import { getErrorMessages, parseRpcError, RPC_ERROR_MESSAGES } from '../constants/errors';
import { offerTimeLabel, relativeDistance } from '../utils/time-labels';
import { formatDate, formatDateTime, formatDay } from '../utils/datetime';
import { formatDiscount, formatPrice } from '../utils/money';
import { seatsLabel } from '../utils/seats';
import { getLabels } from './labels';
import { isLocale, resolveLocale } from './locale';
import { translateValidationMessage } from './validation';
import { createOfferInputSchema, emailSchema } from '../schemas';

describe('Sprache', () => {
  it('erkennt Sprachen aus Browser- und Geräteangaben', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('de_DE')).toBe('de');
    expect(resolveLocale('fr')).toBe('de');
    expect(resolveLocale(undefined)).toBe('de');
    expect(isLocale('en')).toBe(true);
    expect(isLocale('EN')).toBe(false);
  });
});

describe('Labels', () => {
  it('liefert für beide Sprachen dieselben Schlüssel', () => {
    const de = getLabels('de');
    const en = getLabels('en');
    for (const key of Object.keys(de) as (keyof typeof de)[]) {
      expect(Object.keys(en[key]).sort()).toEqual(Object.keys(de[key]).sort());
    }
    expect(en.offerCategory.kochen_essen).toBe('Cooking & Food');
  });
});

describe('Fehlermeldungen', () => {
  it('hat für jeden Code einen englischen Text', () => {
    const en = getErrorMessages('en');
    for (const code of Object.keys(RPC_ERROR_MESSAGES)) {
      expect(en.rpc[code as keyof typeof en.rpc]).toBeTruthy();
    }
  });

  it('nimmt auf Englisch den Standardtext statt des deutschen Server-Details', () => {
    const error = { message: 'AUSGEBUCHT', details: 'Es sind nur noch 2 Plätze frei.' };
    expect(parseRpcError(error)?.message).toBe('Es sind nur noch 2 Plätze frei.');
    expect(parseRpcError(error, 'en')?.message).toBe(getErrorMessages('en').rpc.AUSGEBUCHT);
    expect(parseRpcError({ message: 'irgendwas' }, 'en')?.message).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('Formate auf Englisch', () => {
  const now = '2026-11-13T10:00:00Z';

  it('formatiert Datum und Tag', () => {
    expect(formatDate('2026-11-14T17:00:00Z', { locale: 'en' })).toBe('Sat 14 Nov');
    expect(formatDate('2026-11-14T17:00:00Z', { locale: 'en', withYear: true })).toBe(
      'Sat 14 Nov 2026',
    );
    expect(formatDay('2026-11-14T17:00:00Z', now, 'en')).toBe('tomorrow');
    expect(formatDateTime('2026-11-13T17:00:00Z', now, 'en')).toBe('today, 18:00');
  });

  it('formatiert Preise und Rabatte', () => {
    expect(formatPrice(245000, { locale: 'en' })).toBe('€2,450.00');
    expect(formatPrice(2400, { locale: 'en', omitZeroCents: true })).toBe('€24');
    expect(formatPrice(245000)).toBe('2.450,00 €');
    expect(formatDiscount(40, 'en')).toBe('−40%');
  });

  it('beschriftet Plätze und Zeiten', () => {
    expect(seatsLabel(0, 'en')).toBe('Sold out');
    expect(seatsLabel(2, 'en')).toBe('Only 2 spots left');
    expect(seatsLabel(10, 'en')).toBe('10 spots available');
    expect(relativeDistance('2026-11-13T11:00:00Z', now, 'en')).toBe('in 1 hr');
    expect(
      offerTimeLabel(
        { type: 'einzeltermin', startsAt: '2026-11-13T09:00:00Z', endsAt: '2026-11-13T12:00:00Z' },
        now,
        'en',
      ).text,
    ).toBe('happening now');
  });
});

describe('Validierungstexte', () => {
  it('übersetzt feste und parametrisierte Meldungen', () => {
    const email = emailSchema.safeParse('kein-mail');
    expect(email.success).toBe(false);
    expect(translateValidationMessage(email.error?.issues[0]?.message ?? '', 'en')).toBe(
      'Please enter a valid email address.',
    );
    expect(translateValidationMessage('Titel: mindestens 3 Zeichen.', 'en')).toBe(
      'Title: at least 3 characters.',
    );
    expect(translateValidationMessage('Der Rabatt muss mindestens 20 % betragen.', 'en')).toBe(
      'The discount must be at least 20%.',
    );
    expect(translateValidationMessage('Unbekannt.', 'en')).toBe('Unbekannt.');
    expect(translateValidationMessage('Titel fehlt.', 'de')).toBe('Titel fehlt.');
  });

  it('kennt alle Meldungen eines kaputten Angebots', () => {
    const parsed = createOfferInputSchema({ minDiscountPercent: 20 }).safeParse({});
    expect(parsed.success).toBe(false);
    for (const issue of parsed.error?.issues ?? []) {
      const en = translateValidationMessage(issue.message, 'en');
      // Zod-Standardtexte (z. B. für fehlende Felder) sind schon englisch.
      expect(en).not.toMatch(/[äöüß]|Bitte|fehlt|mindestens|höchstens/);
    }
  });
});
