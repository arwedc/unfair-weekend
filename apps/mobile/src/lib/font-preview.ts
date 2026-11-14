/**
 * Schrift-Vergleich (nur zum Ausprobieren): Überschriften, Kartentitel und Preise lassen sich
 * zwischen Inter, Plus Jakarta Sans und Bricolage Grotesque umschalten. Fließtext bleibt Inter.
 * Die Wahl wird auf dem Gerät gemerkt. Fällt die Entscheidung, wird dieser Schalter wieder entfernt.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { TextStyleName } from '@/theme';

export const HEADING_FONTS = ['inter', 'jakarta', 'bricolage'] as const;
export type HeadingFont = (typeof HEADING_FONTS)[number];

export const HEADING_FONT_LABELS: Record<HeadingFont, string> = {
  inter: 'Inter',
  jakarta: 'Jakarta',
  bricolage: 'Bricolage',
};

type Weight = 400 | 500 | 600 | 700 | 800;

/** Name der geladenen Schriftdatei je Stärke (siehe useFonts im Root-Layout). */
const FAMILIES: Record<Exclude<HeadingFont, 'inter'>, Record<Weight, string>> = {
  jakarta: {
    400: 'PlusJakartaSans_400Regular',
    500: 'PlusJakartaSans_500Medium',
    600: 'PlusJakartaSans_600SemiBold',
    700: 'PlusJakartaSans_700Bold',
    800: 'PlusJakartaSans_800ExtraBold',
  },
  bricolage: {
    400: 'BricolageGrotesque_400Regular',
    500: 'BricolageGrotesque_500Medium',
    600: 'BricolageGrotesque_600SemiBold',
    700: 'BricolageGrotesque_700Bold',
    800: 'BricolageGrotesque_800ExtraBold',
  },
};

/** Diese Text-Stufen bekommen die Überschriften-Schrift, alles andere bleibt Inter. */
const HEADING_VARIANTS: ReadonlySet<TextStyleName> = new Set<TextStyleName>([
  'display',
  'title1',
  'title2',
  'title3',
  'headline',
  'price',
  'voucherCode',
]);

const STORAGE_KEY = 'unfair-weekend:schrift-test';

let current: HeadingFont = 'inter';
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Gemerkte Wahl beim Start laden. Fehler sind egal, dann bleibt es bei Inter.
void AsyncStorage.getItem(STORAGE_KEY)
  .then((value) => {
    if (value && (HEADING_FONTS as readonly string[]).includes(value)) {
      current = value as HeadingFont;
      emit();
    }
  })
  .catch(() => undefined);

export function setHeadingFont(font: HeadingFont) {
  current = font;
  emit();
  void AsyncStorage.setItem(STORAGE_KEY, font).catch(() => undefined);
}

export function useHeadingFont(): HeadingFont {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

/** Schriftfamilie für eine Text-Stufe, oder `undefined`, wenn Inter bleibt. */
export function headingFamily(
  font: HeadingFont,
  variant: TextStyleName,
  weight: number,
): string | undefined {
  if (font === 'inter' || !HEADING_VARIANTS.has(variant)) return undefined;
  const families = FAMILIES[font];
  return families[weight as Weight] ?? families[700];
}
