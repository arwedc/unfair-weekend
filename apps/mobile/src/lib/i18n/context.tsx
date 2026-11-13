import { getLabels, type Locale } from '@repo/shared/i18n';
import { useEffect, useSyncExternalStore } from 'react';

import { getLocale, loadStoredLocale, setLocale, subscribeLocale } from './locale-store';
import { getMessages } from './messages';

/** Lädt die gespeicherte Sprache. Einmal im Root-Layout aufrufen. */
export function useLoadLocale(): void {
  useEffect(() => {
    loadStoredLocale();
  }, []);
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

/**
 * Texte, Enum-Labels und Sprache der Oberfläche.
 * @example const { t, labels, locale } = useT(); <Text>{t.common.retry}</Text>
 */
export function useT() {
  const locale = useLocale();
  return { locale, t: getMessages(locale), labels: getLabels(locale), setLocale };
}

/** Texte für reine Logik ohne React (aktuelle Sprache). */
export function currentMessages() {
  return getMessages(getLocale());
}
