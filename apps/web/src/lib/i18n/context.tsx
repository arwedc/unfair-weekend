'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { DEFAULT_LOCALE, getLabels, type Locale } from '@repo/shared/i18n';
import { getMessages } from './messages';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Gibt die Sprache an Client Components weiter und setzt `<html lang>`. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Texte, Enum-Labels und Sprache für Client Components. */
export function useT() {
  const locale = useContext(LocaleContext);
  return { locale, t: getMessages(locale), labels: getLabels(locale) };
}
