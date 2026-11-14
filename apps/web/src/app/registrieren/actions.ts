'use server';

import { redirect } from 'next/navigation';
import { parseRpcError, registerCompanySchema } from '@repo/shared';
import { translateValidationMessage } from '@repo/shared/i18n';
import { getMyAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { geocode } from '@/lib/offers/geocode';
import { createClient } from '@/lib/supabase/server';

export interface RegistrationState {
  error?: string;
  values?: Record<string, string>;
}

const fields = [
  'company_name',
  'company_description',
  'location_name',
  'street',
  'postal_code',
  'city',
  'phone',
  'website',
] as const;

export async function registerCompanyAction(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const account = await getMyAccount();
  if (account?.role !== 'standort') redirect('/login');
  if (account.location) redirect('/antrag');

  const { locale, t } = await getT();
  const m = t.onboarding.registration;
  const values = Object.fromEntries(
    fields.map((key) => [key, String(formData.get(key) ?? '').trim()]),
  );
  const parsed = registerCompanySchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return { error: issue ? translateValidationMessage(issue, locale) : m.failed, values };
  }
  const { phone } = parsed.data;
  if (!phone) return { error: m.phoneRequired, values };

  const supabase = await createClient();
  // Koordinaten für die Karte, wenn die Adresse gefunden wird. Ohne sie geht der Antrag trotzdem
  // durch; Angebote holen ihre Koordinaten ohnehin selbst.
  const coords = await geocode(
    supabase,
    parsed.data.street,
    parsed.data.postal_code,
    parsed.data.city,
    locale,
  );

  const { error } = await supabase.rpc('register_company', {
    p_company_name: parsed.data.company_name,
    p_location_name: parsed.data.location_name,
    p_street: parsed.data.street,
    p_postal_code: parsed.data.postal_code,
    p_city: parsed.data.city,
    p_phone: phone,
    ...(parsed.data.company_description
      ? { p_company_description: parsed.data.company_description }
      : {}),
    ...(parsed.data.website ? { p_website: parsed.data.website } : {}),
    ...(coords.ok ? { p_lat: coords.lat, p_lng: coords.lng } : {}),
  });
  if (error) return { error: parseRpcError(error, locale)?.message ?? m.failed, values };
  redirect('/antrag');
}
