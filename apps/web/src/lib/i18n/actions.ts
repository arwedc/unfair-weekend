'use server';

import { cookies } from 'next/headers';
import { isLocale } from '@repo/shared/i18n';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from './cookie';

/** Speichert die gewählte Sprache. Next.js rendert die aktuelle Seite danach neu. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
}
