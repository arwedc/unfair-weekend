'use server';

import { redirect } from 'next/navigation';
import { emailSchema } from '@repo/shared';
import { getT } from '@/lib/i18n/locale';
import { NEXT_PARAM, safeNext } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase/server';

export interface LoginState {
  error?: string;
  email?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getT();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!emailSchema.safeParse(email).success || !password) {
    return { error: t.common.login.missing, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === 'email_not_confirmed' ? t.common.login.notConfirmed : t.common.login.wrong,
      email,
    };
  }

  const { data: accountData, error: accountError } = await supabase.rpc('get_my_account');
  const account = accountData as unknown as { role?: string; location?: unknown } | null;

  if (!accountError && account?.role === 'admin') redirect('/admin/zahlungen');

  // Die Website ist für Standorte und Admins. Nutzerkonten werden wieder abgemeldet.
  if (accountError || account?.role !== 'standort' || !account.location) {
    await supabase.auth.signOut();
    return { error: t.common.login.noLocation, email };
  }

  redirect(safeNext(formData.get(NEXT_PARAM)) ?? '/angebote');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
