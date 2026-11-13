import { OFFER_CATEGORIES, OFFER_LIMITS } from '@repo/shared';
import { meetsMinDiscount } from '@repo/shared/utils';
import { berlinLocalToUtc } from '@/lib/offers/berlin-time';
import type { Messages } from '@/lib/i18n/messages';
import { parseEuroToCents, type OfferFormField, type OfferFormValues } from '@/lib/offers/form';

/** Schritte beim Anlegen eines Angebots, in dieser Reihenfolge. Titel und Texte: `t.offers.steps`. */
export const OFFER_STEPS = [
  {
    id: 'was',
    fields: ['title', 'description', 'category', 'image_paths'],
  },
  {
    id: 'wann',
    fields: ['type', 'starts_at', 'ends_at'],
  },
  {
    id: 'preis',
    fields: ['original_price', 'deal_price', 'capacity', 'max_per_user'],
  },
  {
    id: 'wo',
    fields: ['street', 'postal_code', 'city'],
  },
] as const satisfies readonly {
  id: string;
  fields: readonly OfferFormField[];
}[];

export type OfferStepId = (typeof OFFER_STEPS)[number]['id'];
export type StepErrors = Partial<Record<OfferFormField, string>>;

const MS_PER_DAY = 86_400_000;

/** Index des ersten Schritts, der eines der Felder enthält, sonst `null`. */
export function firstStepWithError(errors: StepErrors): number | null {
  const index = OFFER_STEPS.findIndex((s) =>
    s.fields.some((f: OfferFormField) => errors[f] !== undefined),
  );
  return index === -1 ? null : index;
}

/** Liest die aktuellen Formularwerte (wie `readValues` in den Server Actions). */
export function readFormValues(form: HTMLFormElement): OfferFormValues {
  const data = new FormData(form);
  const get = (name: string) => String(data.get(name) ?? '').trim();
  return {
    title: get('title'),
    description: get('description'),
    category: get('category'),
    type: get('type'),
    starts_at: get('starts_at'),
    ends_at: get('ends_at'),
    original_price: get('original_price'),
    deal_price: get('deal_price'),
    capacity: get('capacity'),
    max_per_user: get('max_per_user'),
    street: get('street'),
    postal_code: get('postal_code'),
    city: get('city'),
    image_paths: data
      .getAll('image_paths')
      .map(String)
      .filter((p) => p.length > 0),
  };
}

const toInt = (value: string | undefined) =>
  /^\d+$/.test(value ?? '') ? Number(value) : Number.NaN;

/**
 * Schnelle Prüfung eines Schritts vor „Weiter“. Spiegelt die Regeln aus
 * `createOfferInputSchema`, die echte Prüfung macht weiterhin der Server.
 */
export function validateStep(
  stepId: OfferStepId,
  v: OfferFormValues,
  context: { minDiscountPercent: number; messages: Messages['offers']['validation']; now?: Date },
): StepErrors {
  const errors: StepErrors = {};
  const m = context.messages;
  const s = (field: Exclude<OfferFormField, 'image_paths'>) => v[field] ?? '';

  switch (stepId) {
    case 'was': {
      const title = s('title');
      if (title.length < OFFER_LIMITS.titleMin) errors.title = m.titleMin(OFFER_LIMITS.titleMin);
      const description = s('description');
      if (description.length < OFFER_LIMITS.descriptionMin)
        errors.description = m.descriptionMin(OFFER_LIMITS.descriptionMin);
      if (!(OFFER_CATEGORIES as readonly string[]).includes(s('category')))
        errors.category = m.category;
      break;
    }
    case 'wann': {
      const start = berlinLocalToUtc(s('starts_at'));
      const end = berlinLocalToUtc(s('ends_at'));
      if (!start) errors.starts_at = m.dateTime;
      if (!end) errors.ends_at = m.dateTime;
      if (!start || !end) break;

      if (end <= start) {
        errors.ends_at = m.endAfterStart;
      } else if (end.getTime() - start.getTime() > OFFER_LIMITS.maxDurationDays * MS_PER_DAY) {
        errors.ends_at = m.maxDuration(OFFER_LIMITS.maxDurationDays);
      }
      const now = (context.now ?? new Date()).getTime();
      const single = s('type') !== 'zeitraum';
      if ((single ? start : end).getTime() <= now) {
        errors[single ? 'starts_at' : 'ends_at'] = m.inPast;
      }
      break;
    }
    case 'preis': {
      const original = parseEuroToCents(s('original_price'));
      const deal = parseEuroToCents(s('deal_price'));
      if (original === null) errors.original_price = m.priceOriginal;
      else if (original <= 0) errors.original_price = m.originalPositive;
      if (deal === null) errors.deal_price = m.priceDeal;
      if (original && deal !== null) {
        if (deal >= original) {
          errors.deal_price = m.dealBelowOriginal;
        } else if (!meetsMinDiscount(original, deal, context.minDiscountPercent)) {
          errors.deal_price = m.minDiscount(context.minDiscountPercent);
        }
      }

      const capacity = toInt(s('capacity'));
      const perUser = toInt(s('max_per_user'));
      if (!(capacity >= 1)) errors.capacity = m.capacityMin;
      else if (capacity > OFFER_LIMITS.capacityMax)
        errors.capacity = m.capacityMax(OFFER_LIMITS.capacityMax);
      if (!(perUser >= 1)) errors.max_per_user = m.perUserMin;
      else if (perUser > OFFER_LIMITS.maxPerUserMax)
        errors.max_per_user = m.perUserMax(OFFER_LIMITS.maxPerUserMax);
      else if (capacity >= 1 && perUser > capacity) errors.max_per_user = m.perUserOverCapacity;
      break;
    }
    case 'wo': {
      if (s('street').length < 2) errors.street = m.street;
      if (!/^\d{5}$/.test(s('postal_code'))) errors.postal_code = m.postalCode;
      if (s('city').length < 2) errors.city = m.city;
      break;
    }
  }
  return errors;
}
