/**
 * Sprachen der Oberfläche. Deutsch ist Standard, Englisch ist optional.
 * Übersetzt wird nur die Oberfläche (Labels, Formate, Fehlermeldungen).
 * Inhalte aus der Datenbank (Angebotstexte, Bewertungen …) bleiben, wie sie sind.
 */

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'de';

/** Name jeder Sprache in ihrer eigenen Sprache (für den Umschalter). */
export const LOCALE_NAMES = {
  de: 'Deutsch',
  en: 'English',
} as const satisfies Record<Locale, string>;

/** BCP-47-Tag, z. B. für `<html lang>` oder `accessibilityLanguage`. */
export const LOCALE_TAGS = {
  de: 'de-DE',
  en: 'en-GB',
} as const satisfies Record<Locale, string>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Macht aus einem beliebigen Sprach-Tag eine unterstützte Sprache.
 * @example resolveLocale('en-US') // 'en'
 * @example resolveLocale('fr') // 'de'
 * @example resolveLocale(undefined) // 'de'
 */
export function resolveLocale(value: string | null | undefined): Locale {
  const base = value?.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : DEFAULT_LOCALE;
}
