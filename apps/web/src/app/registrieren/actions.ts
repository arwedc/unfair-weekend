'use server';

import { redirect } from 'next/navigation';
import { parseRpcError, registerCompanySchema } from '@repo/shared';
import { getMyAccount } from '@/lib/auth';
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

  const values = Object.fromEntries(
    fields.map((key) => [key, String(formData.get(key) ?? '').trim()]),
  );
  const parsed = registerCompanySchema.safeParse(values);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Bitte prüfe deine Angaben.', values };
  const phone = parsed.data.phone;
  if (!phone)
    return {
      error: 'Bitte gib eine Telefonnummer an, unter der wir dich erreichen können.',
      values,
    };

  const supabase = await createClient();
  const { error } = await supabase.rpc('register_company', {
    p_company_name: parsed.data.company_name,
    p_location_name: parsed.data.location_name,
    p_street: parsed.data.street,
    p_postal_code: parsed.data.postal_code,
    p_city: parsed.data.city,
    ...(parsed.data.company_description
      ? { p_company_description: parsed.data.company_description }
      : {}),
    p_phone: phone,
    ...(parsed.data.website ? { p_website: parsed.data.website } : {}),
  });
  if (error)
    return {
      error: parseRpcError(error)?.message ?? 'Der Antrag konnte nicht gespeichert werden.',
      values,
    };
  redirect('/antrag');
}
