import { OFFER_CATEGORIES, OFFER_LIMITS } from '@repo/shared';
import { meetsMinDiscount } from '@repo/shared/utils';
import { berlinLocalToUtc } from '@/lib/offers/berlin-time';
import { parseEuroToCents, type OfferFormField, type OfferFormValues } from '@/lib/offers/form';

/** Schritte beim Anlegen eines Angebots, in dieser Reihenfolge. */
export const OFFER_STEPS = [
  {
    id: 'was',
    title: 'Worum geht es?',
    description: 'Titel, Beschreibung und ein Bild sind das Erste, was die Leute sehen.',
    fields: ['title', 'description', 'category', 'image_paths'],
  },
  {
    id: 'wann',
    title: 'Wann?',
    description: 'Ein fester Termin oder ein Zeitraum, in dem der Code einlösbar ist.',
    fields: ['type', 'starts_at', 'ends_at'],
  },
  {
    id: 'preis',
    title: 'Preis und Plätze',
    description: 'Wie viel spart man, und wie viele Plätze gibt es?',
    fields: ['original_price', 'deal_price', 'capacity', 'max_per_user'],
  },
  {
    id: 'wo',
    title: 'Wo?',
    description: 'Hier findet das Angebot statt bzw. wird der Code eingelöst.',
    fields: ['street', 'postal_code', 'city'],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  description: string;
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
  context: { minDiscountPercent: number; now?: Date },
): StepErrors {
  const errors: StepErrors = {};
  const s = (field: Exclude<OfferFormField, 'image_paths'>) => v[field] ?? '';

  switch (stepId) {
    case 'was': {
      const title = s('title');
      if (title.length < OFFER_LIMITS.titleMin)
        errors.title = `Titel: mindestens ${OFFER_LIMITS.titleMin} Zeichen.`;
      const description = s('description');
      if (description.length < OFFER_LIMITS.descriptionMin)
        errors.description = `Beschreibung: mindestens ${OFFER_LIMITS.descriptionMin} Zeichen.`;
      if (!(OFFER_CATEGORIES as readonly string[]).includes(s('category')))
        errors.category = 'Bitte eine Kategorie wählen.';
      break;
    }
    case 'wann': {
      const start = berlinLocalToUtc(s('starts_at'));
      const end = berlinLocalToUtc(s('ends_at'));
      if (!start) errors.starts_at = 'Bitte Datum und Uhrzeit wählen.';
      if (!end) errors.ends_at = 'Bitte Datum und Uhrzeit wählen.';
      if (!start || !end) break;

      if (end <= start) {
        errors.ends_at = 'Das Ende muss nach dem Beginn liegen.';
      } else if (end.getTime() - start.getTime() > OFFER_LIMITS.maxDurationDays * MS_PER_DAY) {
        errors.ends_at = `Höchstens ${OFFER_LIMITS.maxDurationDays} Tage Dauer.`;
      }
      const now = (context.now ?? new Date()).getTime();
      const single = s('type') !== 'zeitraum';
      if ((single ? start : end).getTime() <= now) {
        errors[single ? 'starts_at' : 'ends_at'] = 'Der Zeitpunkt liegt in der Vergangenheit.';
      }
      break;
    }
    case 'preis': {
      const original = parseEuroToCents(s('original_price'));
      const deal = parseEuroToCents(s('deal_price'));
      if (original === null) errors.original_price = 'Bitte einen Preis eingeben, z. B. 69,00.';
      else if (original <= 0) errors.original_price = 'Der Originalpreis muss größer als 0 sein.';
      if (deal === null) errors.deal_price = 'Bitte einen Preis eingeben, z. B. 39,00.';
      if (original && deal !== null) {
        if (deal >= original) {
          errors.deal_price = 'Der Deal-Preis muss unter dem Originalpreis liegen.';
        } else if (!meetsMinDiscount(original, deal, context.minDiscountPercent)) {
          errors.deal_price = `Der Rabatt muss mindestens ${context.minDiscountPercent} % betragen.`;
        }
      }

      const capacity = toInt(s('capacity'));
      const perUser = toInt(s('max_per_user'));
      if (!(capacity >= 1)) errors.capacity = 'Mindestens 1 Platz.';
      else if (capacity > OFFER_LIMITS.capacityMax)
        errors.capacity = `Höchstens ${OFFER_LIMITS.capacityMax} Plätze.`;
      if (!(perUser >= 1)) errors.max_per_user = 'Mindestens 1 Platz pro Person.';
      else if (perUser > OFFER_LIMITS.maxPerUserMax)
        errors.max_per_user = `Höchstens ${OFFER_LIMITS.maxPerUserMax} Plätze pro Person.`;
      else if (capacity >= 1 && perUser > capacity)
        errors.max_per_user = 'Plätze pro Person dürfen das Kontingent nicht übersteigen.';
      break;
    }
    case 'wo': {
      if (s('street').length < 2) errors.street = 'Bitte Straße und Hausnummer eingeben.';
      if (!/^\d{5}$/.test(s('postal_code'))) errors.postal_code = 'Fünfstellige Postleitzahl.';
      if (s('city').length < 2) errors.city = 'Bitte den Ort eingeben.';
      break;
    }
  }
  return errors;
}
