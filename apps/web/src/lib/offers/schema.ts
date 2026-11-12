import { OFFER_TYPES } from '@repo/shared';
import { formatPrice, maxDealPriceCents, meetsMinDiscount } from '@repo/shared/utils';
import { z } from 'zod';
import { berlinLocalToUtc } from './berlin-time';
import { CATEGORIES } from './categories';

/**
 * Mindestrabatt in Prozent. Im echten Betrieb eine Admin-Einstellung, die der Server prüft.
 * Hier nur für schnelles Feedback im Formular.
 */
export const MIN_DISCOUNT_PERCENT = 20;

/** „29,90“, „29.90“ oder „29“ → Cent. Gibt `null` bei ungültiger Eingabe. */
export function parseEuroToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

const euro = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} fehlt.`)
    .transform((value, ctx) => {
      const cents = parseEuroToCents(value);
      if (cents === null || cents <= 0) {
        ctx.addIssue({ code: 'custom', message: `Bitte einen Betrag wie 29,90 eingeben.` });
        return z.NEVER;
      }
      return cents;
    });

const localDateTime = (label: string) =>
  z
    .string()
    .min(1, `${label} fehlt.`)
    .transform((value, ctx) => {
      const date = berlinLocalToUtc(value);
      if (!date) {
        ctx.addIssue({ code: 'custom', message: `${label} ist ungültig.` });
        return z.NEVER;
      }
      return date;
    });

const integer = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} fehlt.`)
    .transform(Number)
    .pipe(
      z
        .number({ message: 'Bitte eine Zahl eingeben.' })
        .int('Bitte eine ganze Zahl eingeben.')
        .min(min, `Mindestens ${min}.`)
        .max(max, `Höchstens ${max}.`),
    );

/**
 * Formular „Angebot anlegen“. Nimmt die Rohwerte aus FormData (alles Strings).
 * TODO: nach @repo/shared verschieben, sobald der Backend-Vertrag steht.
 */
export const createOfferSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Der Titel braucht mindestens 3 Zeichen.')
      .max(80, 'Der Titel darf höchstens 80 Zeichen haben.'),
    description: z
      .string()
      .trim()
      .min(20, 'Beschreib das Angebot in mindestens 20 Zeichen.')
      .max(2000, 'Die Beschreibung darf höchstens 2000 Zeichen haben.'),
    category: z.enum(CATEGORIES, { message: 'Bitte eine Kategorie wählen.' }),
    type: z.enum(OFFER_TYPES, { message: 'Bitte eine Art wählen.' }),
    startsAt: localDateTime('Beginn'),
    endsAt: localDateTime('Ende'),
    originalPriceCents: euro('Originalpreis'),
    dealPriceCents: euro('Deal-Preis'),
    capacity: integer('Plätze', 1, 500),
    maxPerUser: integer('Plätze pro Person', 1, 20),
    address: z
      .string()
      .trim()
      .min(5, 'Bitte die Adresse angeben.')
      .max(200, 'Die Adresse ist zu lang.'),
  })
  .superRefine((offer, ctx) => {
    if (offer.endsAt <= offer.startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Das Ende muss nach dem Beginn liegen.',
      });
    }
    const now = Date.now();
    if (offer.type === 'einzeltermin' && offer.startsAt.getTime() <= now) {
      ctx.addIssue({
        code: 'custom',
        path: ['startsAt'],
        message: 'Der Termin muss in der Zukunft liegen.',
      });
    }
    if (offer.type === 'zeitraum' && offer.endsAt.getTime() <= now) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Der Zeitraum muss in der Zukunft enden.',
      });
    }
    if (!meetsMinDiscount(offer.originalPriceCents, offer.dealPriceCents, MIN_DISCOUNT_PERCENT)) {
      const max = maxDealPriceCents(offer.originalPriceCents, MIN_DISCOUNT_PERCENT);
      ctx.addIssue({
        code: 'custom',
        path: ['dealPriceCents'],
        message: `Mindestens ${MIN_DISCOUNT_PERCENT} % Rabatt, also höchstens ${formatPrice(max)}.`,
      });
    }
    if (offer.maxPerUser > offer.capacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxPerUser'],
        message: 'Darf nicht größer sein als die Gesamtzahl der Plätze.',
      });
    }
  });

export type CreateOfferInput = z.output<typeof createOfferSchema>;
export type CreateOfferField = keyof z.input<typeof createOfferSchema>;
