'use server';

import { redirect } from 'next/navigation';
import { emailSchema } from '@repo/shared';
import { getMyAccount } from '@/lib/auth';
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

  const account = await getMyAccount();
  if (account?.role === 'admin') redirect('/admin');
  if (account?.role === 'standort') {
    if (!account.location) redirect('/registrieren');
    redirect(account.location.status === 'approved' ? '/angebote' : '/antrag');
  }

  // Nutzerkonten gehören nicht in das Partnerportal.
  await supabase.auth.signOut();
  return {
    error: account
      ? 'Dieses Konto gehört nicht zum Partnerportal.'
      : 'Das Konto konnte nicht geladen werden.',
    email,
  };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
