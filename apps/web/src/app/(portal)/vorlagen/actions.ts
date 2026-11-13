'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createOfferTemplateSchema,
  parseRpcError,
  toRpcArgs,
  type OfferTemplateInput,
} from '@repo/shared';
import { translateValidationMessage } from '@repo/shared/i18n';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { parseEuroToCents } from '@/lib/offers/form';
import { getMinDiscountPercent } from '@/lib/offers/queries';
import { createClient } from '@/lib/supabase/server';
import {
  durationToMinutes,
  TEMPLATE_FORM_FIELDS,
  type TemplateFormField,
  type TemplateFormState,
  type TemplateFormValues,
} from '@/lib/templates/form';

type Errors = TemplateFormState['errors'];

/** Fehler aus Zod (Feldnamen wie in der DB) → Formularfeld. */
const SCHEMA_FIELD_TO_FORM: Record<string, TemplateFormField> = {
  original_price_cents: 'original_price',
  deal_price_cents: 'deal_price',
  duration_minutes: 'duration_value',
};

/** RPC-Fehlercodes, die sich einem Feld zuordnen lassen. Alles andere unten im Formular. */
const RPC_CODE_TO_FIELD: Partial<Record<string, TemplateFormField>> = {
  VORLAGENNAME_VERGEBEN: 'name',
  RABATT_ZU_GERING: 'deal_price',
  PREIS_UNGUELTIG: 'deal_price',
  ZEIT_UNGUELTIG: 'duration_value',
  BILDER_UNGUELTIG: 'image_paths',
};

function readValues(formData: FormData): TemplateFormValues {
  const values: TemplateFormValues = {};
  for (const field of TEMPLATE_FORM_FIELDS) {
    values[field] = String(formData.get(field) ?? '').trim();
  }
  values.image_paths = [];
  return values;
}

function toInt(value: string | undefined): number {
  return /^\d+$/.test(value ?? '') ? Number(value) : Number.NaN;
}

/** Wandelt Formularwerte in die Eingabe für create_offer_template/update_offer_template um. */
type I18n = Awaited<ReturnType<typeof getT>>;

function buildInput(
  values: TemplateFormValues,
  minDiscountPercent: number,
  { locale, t }: I18n,
): { input?: OfferTemplateInput; errors: Errors } {
  const errors: Errors = {};
  const m = t.offers.validation;
  const v = (field: (typeof TEMPLATE_FORM_FIELDS)[number]) => values[field] ?? '';

  const originalCents = parseEuroToCents(v('original_price'));
  const dealCents = parseEuroToCents(v('deal_price'));
  if (originalCents === null) errors.original_price = m.priceOriginal;
  if (dealCents === null) errors.deal_price = m.priceDeal;

  const durationMinutes = durationToMinutes(v('duration_value'), v('duration_unit'));
  if (Number.isNaN(durationMinutes)) {
    errors.duration_value = t.templates.validation.duration;
  }

  if (Object.keys(errors).length > 0) return { errors };

  const parsed = createOfferTemplateSchema({ minDiscountPercent }).safeParse({
    name: v('name'),
    title: v('title'),
    description: v('description'),
    category: v('category') || undefined,
    image_paths: values.image_paths ?? [],
    original_price_cents: originalCents,
    deal_price_cents: dealCents,
    capacity: toInt(v('capacity')),
    max_per_user: toInt(v('max_per_user')),
    type: v('type'),
    duration_minutes: durationMinutes,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      const field = SCHEMA_FIELD_TO_FORM[key] ?? (key as TemplateFormField);
      errors[field] ??= translateValidationMessage(issue.message, locale);
    }
    return { errors };
  }
  return { input: parsed.data, errors };
}

function rpcFailure(
  error: Parameters<typeof parseRpcError>[0],
  values: TemplateFormValues,
  { locale, t }: I18n,
): TemplateFormState {
  const parsed = parseRpcError(error, locale);
  const message = parsed?.message ?? t.common.saveFailed;
  const field = parsed ? RPC_CODE_TO_FIELD[parsed.code] : undefined;
  return field
    ? { errors: { [field]: message }, formError: t.common.checkFields, values }
    : { errors: {}, formError: message, values };
}

export async function createTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireAccount();
  const i18n = await getT();
  const values = readValues(formData);
  const { input, errors } = buildInput(values, await getMinDiscountPercent(), i18n);
  if (!input) return { errors, values, formError: i18n.t.common.checkFields };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_offer_template', toRpcArgs(input));
  if (error || !data) return rpcFailure(error, values, i18n);

  revalidatePath('/vorlagen');
  redirect('/vorlagen?gespeichert=1');
}

export async function updateTemplateAction(
  templateId: string,
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireAccount();
  const i18n = await getT();
  const values = readValues(formData);
  const { input, errors } = buildInput(values, await getMinDiscountPercent(), i18n);
  if (!input) return { errors, values, formError: i18n.t.common.checkFields };

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_offer_template', {
    p_template_id: templateId,
    ...toRpcArgs(input),
  });
  if (error) return rpcFailure(error, values, i18n);

  revalidatePath('/vorlagen');
  revalidatePath(`/vorlagen/${templateId}`);
  return { errors: {}, values, saved: true };
}

export interface DeleteTemplateState {
  error?: string;
}

export async function deleteTemplateAction(templateId: string): Promise<DeleteTemplateState> {
  await requireAccount();
  const { locale, t } = await getT();
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_offer_template', { p_template_id: templateId });
  if (error) return { error: parseRpcError(error, locale)?.message ?? t.templates.delete.failed };

  revalidatePath('/vorlagen');
  redirect('/vorlagen?geloescht=1');
}
