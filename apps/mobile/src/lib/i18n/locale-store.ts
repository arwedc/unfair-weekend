/**
 * Gewählte Sprache der Oberfläche. Lebt außerhalb von React, damit auch reine Logik
 * (z. B. Fehlertexte in `api-error.ts`) die aktuelle Sprache kennt.
 * Ohne Wahl gilt die Gerätesprache (Englisch, wenn das Gerät nicht auf Deutsch steht).
 * Übersetzt wird nur die Oberfläche, nicht Inhalte wie Angebotstexte oder Bewertungen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLocale, resolveLocale, type Locale } from '@repo/shared/i18n';

const STORAGE_KEY = 'unfair-weekend:sprache';

function deviceLocale(): Locale {
  try {
    return resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'de';
  }
}

let current: Locale = deviceLocale();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getLocale(): Locale {
  return current;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLocale(next: Locale): void {
  loaded = true;
  if (next === current) return;
  current = next;
  emit();
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
    // Nicht schlimm: Beim nächsten Start gilt wieder die Gerätesprache.
  });
}

/** Liest die gespeicherte Wahl einmal beim Start. */
export function loadStoredLocale(): void {
  AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      if (loaded || !isLocale(stored) || stored === current) return;
      current = stored;
      emit();
    })
    .catch(() => {
      // Ohne gespeicherte Wahl bleibt die Gerätesprache.
    });
}
