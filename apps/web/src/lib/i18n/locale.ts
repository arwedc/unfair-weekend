import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { getLabels, isLocale, resolveLocale, type Locale } from '@repo/shared/i18n';
import { LOCALE_COOKIE } from './cookie';
import { getMessages } from './messages';

/**
 * Sprache der Anfrage: gespeicherte Wahl (Cookie), sonst erste Sprache des Browsers,
 * sonst Deutsch. Pro Anfrage nur einmal ausgewertet.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  const accept = (await headers()).get('accept-language') ?? '';
  return resolveLocale(accept.split(',')[0]);
});

/** Texte, Enum-Labels und Sprache für Server Components und Server Actions. */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: getMessages(locale), labels: getLabels(locale) };
}
