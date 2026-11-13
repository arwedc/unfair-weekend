'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { locationSignUpSchema, profileSchema } from '@repo/shared';
import { createClient } from '@/lib/supabase/server';

export interface SignUpState {
  error?: string;
  email?: string;
  sent?: boolean;
}

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const credentials = locationSignUpSchema.safeParse({ email, password });
  const contact = profileSchema.safeParse({ first_name: firstName, last_name: lastName });

  if (!credentials.success || !contact.success) {
    const issues = [
      ...(credentials.success ? [] : credentials.error.issues),
      ...(contact.success ? [] : contact.error.issues),
    ];
    return {
      error: issues[0]?.message ?? 'Bitte prüfe deine Angaben.',
      email,
    };
  }

  const origin = (await headers()).get('origin');
  if (!origin || !/^https?:\/\//.test(origin)) {
    return { error: 'Die Registrierungsseite konnte nicht sicher erkannt werden.', email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: credentials.data.email,
    password: credentials.data.password,
    options: {
      data: {
        account_type: 'standort',
        first_name: contact.data.first_name,
        last_name: contact.data.last_name,
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return {
      error: 'Konto konnte nicht erstellt werden. Prüfe die E-Mail-Adresse oder melde dich an.',
      email,
    };
  }

  if (data.session) redirect('/registrieren');
  return { email, sent: true };
}
