import { describe, expect, it } from 'vitest';
import {
  createOfferInputSchema,
  normalizeShortCode,
  offerInputSchema,
  profileSchema,
  registerCompanySchema,
  toRpcArgs,
} from './index';

const validOffer = {
  title: 'Pasta-Kurs mit Nonna',
  description: 'Frische Pasta von Hand, inklusive Wein.',
  category: 'kochen_essen' as const,
  image_paths: ['loc/bild-1.jpg'],
  original_price_cents: 4000,
  deal_price_cents: 2400,
  capacity: 10,
  max_per_user: 2,
  address: 'Prinzipalmarkt 1, 48143 Münster',
  lat: 51.9625,
  lng: 7.628,
  type: 'einzeltermin' as const,
  starts_at: '2026-11-20T17:00:00Z',
  ends_at: '2026-11-20T20:00:00Z',
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('toRpcArgs', () => {
  it('ergänzt das Präfix p_', () => {
    expect(toRpcArgs({ first_name: 'Mia', last_name: 'Muster' })).toEqual({
      p_first_name: 'Mia',
      p_last_name: 'Muster',
    });
  });
});

describe('profileSchema', () => {
  it('trimmt und prüft die Länge', () => {
    expect(profileSchema.parse({ first_name: ' Mia ', last_name: 'Muster' }).first_name).toBe(
      'Mia',
    );
    expect(profileSchema.safeParse({ first_name: '  ', last_name: 'Muster' }).success).toBe(false);
  });
});

describe('registerCompanySchema', () => {
  it('verlangt eine 5-stellige PLZ und beide oder keine Koordinaten', () => {
    const base = {
      company_name: 'Kochschule Münster',
      location_name: 'Kochschule Altstadt',
      street: 'Ludgeristraße 1',
      postal_code: '48143',
      city: 'Münster',
    };
    expect(registerCompanySchema.safeParse(base).success).toBe(true);
    expect(registerCompanySchema.safeParse({ ...base, postal_code: '4814' }).success).toBe(false);
    expect(registerCompanySchema.safeParse({ ...base, lat: 51.9 }).success).toBe(false);
  });

  it('macht leere optionale Felder zu undefined', () => {
    const parsed = registerCompanySchema.parse({
      company_name: 'Kochschule Münster',
      location_name: 'Altstadt',
      street: 'Ludgeristraße 1',
      postal_code: '48143',
      city: 'Münster',
      phone: '  ',
    });
    expect(parsed.phone).toBeUndefined();
  });
});

describe('offerInputSchema', () => {
  it('akzeptiert ein gültiges Angebot', () => {
    expect(offerInputSchema.safeParse(validOffer).success).toBe(true);
  });

  it('lehnt Deal-Preis ≥ Original, zu viele Plätze pro Person und falsche Zeiten ab', () => {
    expect(
      issuePaths(offerInputSchema.safeParse({ ...validOffer, deal_price_cents: 4000 })),
    ).toContain('deal_price_cents');
    expect(issuePaths(offerInputSchema.safeParse({ ...validOffer, max_per_user: 11 }))).toContain(
      'max_per_user',
    );
    expect(
      issuePaths(offerInputSchema.safeParse({ ...validOffer, ends_at: '2026-11-20T16:00:00Z' })),
    ).toContain('ends_at');
  });

  it('verlangt 1 bis 5 Bilder', () => {
    expect(offerInputSchema.safeParse({ ...validOffer, image_paths: [] }).success).toBe(false);
    expect(
      offerInputSchema.safeParse({ ...validOffer, image_paths: Array(6).fill('x.jpg') }).success,
    ).toBe(false);
  });
});

describe('createOfferInputSchema', () => {
  const now = new Date('2026-11-12T10:00:00Z');

  it('prüft den Mindestrabatt wie der Server', () => {
    const schema = createOfferInputSchema({ minDiscountPercent: 20, now });
    expect(schema.safeParse({ ...validOffer, deal_price_cents: 3200 }).success).toBe(true);
    expect(issuePaths(schema.safeParse({ ...validOffer, deal_price_cents: 3201 }))).toContain(
      'deal_price_cents',
    );
  });

  it('verlangt beim Einzeltermin einen Beginn in der Zukunft, beim Zeitraum ein Ende', () => {
    const schema = createOfferInputSchema({ minDiscountPercent: 20, now });
    const past = {
      ...validOffer,
      starts_at: '2026-11-12T09:00:00Z',
      ends_at: '2026-11-12T12:00:00Z',
    };
    expect(issuePaths(schema.safeParse(past))).toContain('starts_at');
    expect(schema.safeParse({ ...past, type: 'zeitraum' }).success).toBe(true);
  });
});

describe('normalizeShortCode', () => {
  it('vereinheitlicht Eingaben', () => {
    expect(normalizeShortCode('k7q4mx')).toBe('K7Q-4MX');
    expect(normalizeShortCode(' K7Q - 4MX ')).toBe('K7Q-4MX');
  });

  it('lehnt falsche Länge und verwechselbare Zeichen ab', () => {
    expect(normalizeShortCode('K7Q4M')).toBeNull();
    expect(normalizeShortCode('K0Q-4MX')).toBeNull();
  });
});
