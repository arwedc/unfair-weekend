'use server';

import { redirect } from 'next/navigation';
import { emailSchema } from '@repo/shared';
import { createClient } from '@/lib/supabase/server';

export interface LoginState {
  error?: string;
  email?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!emailSchema.safeParse(email).success || !password) {
    return { error: 'Bitte E-Mail und Passwort eingeben.', email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === 'email_not_confirmed'
          ? 'Bitte bestätige zuerst deine E-Mail-Adresse.'
          : 'E-Mail oder Passwort stimmt nicht.',
      email,
    };
  }

  const { data: accountData, error: accountError } = await supabase.rpc('get_my_account');
  const account = accountData as unknown as { role?: string; location?: unknown } | null;

  if (!accountError && account?.role === 'admin') redirect('/admin/zahlungen');

  // Die Website ist für Standorte und Admins. Nutzerkonten werden wieder abgemeldet.
  if (accountError || account?.role !== 'standort' || !account.location) {
    await supabase.auth.signOut();
    return { error: 'Dieses Konto gehört zu keinem Standort.', email };
  }

  redirect('/angebote');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
