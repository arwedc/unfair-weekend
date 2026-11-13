'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { locationSignUpSchema, profileSchema } from '@repo/shared';
import { translateValidationMessage } from '@repo/shared/i18n';
import { getT } from '@/lib/i18n/locale';
import { createClient } from '@/lib/supabase/server';

export interface SignUpState {
  error?: string;
  email?: string;
  sent?: boolean;
}

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const { locale, t } = await getT();
  const m = t.onboarding.signUp;
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
    const issue = issues[0]?.message;
    return { error: issue ? translateValidationMessage(issue, locale) : m.checkInput, email };
  }

  const origin = (await headers()).get('origin');
  if (!origin || !/^https?:\/\//.test(origin)) {
    return { error: m.originUnknown, email };
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
    return { error: m.failed, email };
  }

  if (data.session) redirect('/registrieren');
  return { email, sent: true };
}
