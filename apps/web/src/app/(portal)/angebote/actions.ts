'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createOfferInputSchema,
  offerInputSchema,
  offerReasonSchema,
  parseRpcError,
  toRpcArgs,
  type OfferInput,
} from '@repo/shared';
import { requireAccount } from '@/lib/auth';
import { berlinLocalToUtc } from '@/lib/offers/berlin-time';
import {
  joinAddress,
  LOCKED_WHEN_CODES,
  OFFER_FORM_FIELDS,
  offerToFormValues,
  parseEuroToCents,
  type OfferFormField,
  type OfferFormState,
  type OfferFormValues,
} from '@/lib/offers/form';
import { geocode } from '@/lib/offers/geocode';
import { getMinDiscountPercent, getMyOffer, offerHasCodes, type Offer } from '@/lib/offers/queries';
import { createClient } from '@/lib/supabase/server';

type Errors = OfferFormState['errors'];

/** Fehler aus Zod (Feldnamen wie in der DB) → Formularfeld. */
const SCHEMA_FIELD_TO_FORM: Record<string, OfferFormField> = {
  original_price_cents: 'original_price',
  deal_price_cents: 'deal_price',
  address: 'street',
  lat: 'street',
  lng: 'street',
};

/** RPC-Fehlercodes, die sich einem Feld zuordnen lassen. Alles andere oben im Formular. */
const RPC_CODE_TO_FIELD: Partial<Record<string, OfferFormField>> = {
  RABATT_ZU_GERING: 'deal_price',
  PREIS_UNGUELTIG: 'deal_price',
  ZEIT_UNGUELTIG: 'ends_at',
  ZEIT_IN_VERGANGENHEIT: 'starts_at',
  BILDER_UNGUELTIG: 'image_paths',
  ADRESSE_UNGUELTIG: 'street',
  KONTINGENT_ZU_KLEIN: 'capacity',
};

function readValues(formData: FormData): OfferFormValues {
  const values: OfferFormValues = {};
  for (const field of OFFER_FORM_FIELDS) values[field] = String(formData.get(field) ?? '').trim();
  values.image_paths = formData
    .getAll('image_paths')
    .map(String)
    .filter((p) => p.length > 0);
  return values;
}

function toInt(value: string | undefined): number {
  return /^\d+$/.test(value ?? '') ? Number(value) : Number.NaN;
}

/**
 * Wandelt Formularwerte in die Eingabe für create_offer/update_offer um,
 * inklusive Koordinaten. Gibt Feldfehler zurück, wenn etwas nicht passt.
 */
async function buildInput(
  values: OfferFormValues,
  context: { existing?: Offer; minDiscountPercent: number; strict: boolean },
): Promise<{ input?: OfferInput; errors: Errors }> {
  const errors: Errors = {};
  const v = (field: (typeof OFFER_FORM_FIELDS)[number]) => values[field] ?? '';

  const originalCents = parseEuroToCents(v('original_price'));
  const dealCents = parseEuroToCents(v('deal_price'));
  if (originalCents === null) errors.original_price = 'Bitte einen Preis eingeben, z. B. 69,00.';
  if (dealCents === null) errors.deal_price = 'Bitte einen Preis eingeben, z. B. 39,00.';

  const startsAt = berlinLocalToUtc(v('starts_at'));
  const endsAt = berlinLocalToUtc(v('ends_at'));
  if (!startsAt) errors.starts_at = 'Bitte Datum und Uhrzeit wählen.';
  if (!endsAt) errors.ends_at = 'Bitte Datum und Uhrzeit wählen.';

  const street = v('street');
  const postalCode = v('postal_code');
  const city = v('city');
  if (street.length < 2) errors.street = 'Bitte Straße und Hausnummer eingeben.';
  if (!/^\d{5}$/.test(postalCode)) errors.postal_code = 'Fünfstellige Postleitzahl.';
  if (city.length < 2) errors.city = 'Bitte den Ort eingeben.';
  const address = joinAddress(street, postalCode, city);

  // Koordinaten: unveränderte Adresse behält ihre Koordinaten, sonst Geocoding.
  let lat = Number.NaN;
  let lng = Number.NaN;
  if (!errors.street && !errors.postal_code && !errors.city) {
    if (context.existing && context.existing.address === address) {
      lat = context.existing.lat;
      lng = context.existing.lng;
    } else {
      const supabase = await createClient();
      const result = await geocode(supabase, street, postalCode, city);
      if (result.ok) {
        lat = result.lat;
        lng = result.lng;
      } else {
        errors.street = result.message;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  const schema = context.strict
    ? createOfferInputSchema({ minDiscountPercent: context.minDiscountPercent })
    : offerInputSchema;
  const parsed = schema.safeParse({
    title: v('title'),
    description: v('description'),
    category: v('category') || undefined,
    image_paths: values.image_paths ?? [],
    original_price_cents: originalCents,
    deal_price_cents: dealCents,
    capacity: toInt(v('capacity')),
    max_per_user: toInt(v('max_per_user')),
    address,
    lat,
    lng,
    type: v('type'),
    starts_at: startsAt?.toISOString(),
    ends_at: endsAt?.toISOString(),
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      const field = SCHEMA_FIELD_TO_FORM[key] ?? (key as OfferFormField);
      errors[field] ??= issue.message;
    }
    return { errors };
  }
  return { input: parsed.data, errors };
}

function rpcFailure(
  error: Parameters<typeof parseRpcError>[0],
  values: OfferFormValues,
): OfferFormState {
  const parsed = parseRpcError(error);
  const message = parsed?.message ?? 'Speichern hat nicht geklappt.';
  const field = parsed ? RPC_CODE_TO_FIELD[parsed.code] : undefined;
  return field
    ? { errors: { [field]: message }, values }
    : { errors: {}, formError: message, values };
}

export async function createOfferAction(
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  await requireAccount();
  const values = readValues(formData);
  const minDiscountPercent = await getMinDiscountPercent();
  const { input, errors } = await buildInput(values, { minDiscountPercent, strict: true });
  if (!input) return { errors, values, formError: 'Bitte die markierten Felder prüfen.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_offer', toRpcArgs(input));
  if (error || !data) return rpcFailure(error, values);

  revalidatePath('/angebote');
  redirect(`/angebote/${data.id}?neu=1`);
}

export async function updateOfferAction(
  offerId: string,
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  await requireAccount();
  const existing = await getMyOffer(offerId);
  if (!existing) return { errors: {}, formError: 'Dieses Angebot gibt es nicht (mehr).' };

  const values = readValues(formData);
  const locked = await offerHasCodes(offerId);
  if (locked) {
    // Gesperrte Felder sind im Formular deaktiviert und kommen nicht mit. Gespeicherte Werte nehmen.
    const saved = offerToFormValues(existing);
    for (const field of LOCKED_WHEN_CODES) {
      if (field !== 'image_paths') values[field] = saved[field];
    }
  }

  // Mindestrabatt und „nicht in der Vergangenheit“ nur prüfen, wenn Preise oder Zeiten neu sind.
  const before = offerToFormValues(existing);
  const changedPriceOrTime = (
    ['original_price', 'deal_price', 'starts_at', 'ends_at', 'type'] as const
  ).some((f) => values[f] !== before[f]);
  const minDiscountPercent = await getMinDiscountPercent();
  const { input, errors } = await buildInput(values, {
    existing,
    minDiscountPercent,
    strict: changedPriceOrTime,
  });
  if (!input) return { errors, values, formError: 'Bitte die markierten Felder prüfen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_offer', {
    p_offer_id: offerId,
    ...toRpcArgs(input),
  });
  if (error) return rpcFailure(error, values);

  revalidatePath('/angebote');
  revalidatePath(`/angebote/${offerId}`);
  return { errors: {}, values, saved: true };
}

export interface CancelOfferState {
  error?: string;
}

export async function cancelOfferAction(
  offerId: string,
  _prev: CancelOfferState,
  formData: FormData,
): Promise<CancelOfferState> {
  await requireAccount();
  const reasonRaw = String(formData.get('reason') ?? '').trim();
  const parsed = offerReasonSchema.safeParse({ reason: reasonRaw || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Begründung zu lang.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_offer', {
    p_offer_id: offerId,
    ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
  });
  if (error) return { error: parseRpcError(error)?.message ?? 'Absagen hat nicht geklappt.' };

  const cancelled = (data as { cancelled_vouchers?: number } | null)?.cancelled_vouchers ?? 0;
  revalidatePath('/angebote');
  revalidatePath(`/angebote/${offerId}`);
  redirect(`/angebote/${offerId}?abgesagt=${cancelled}`);
}
