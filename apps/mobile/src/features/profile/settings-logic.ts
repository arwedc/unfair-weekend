/**
 * Reine Logik der Einstellungen: was die Zeile „Standortzugriff“ zeigt und was ein Tipp tut.
 * Ohne React und ohne Netzwerk, damit sie sich testen lässt.
 */
import { DEFAULT_LOCALE, type Locale } from '@repo/shared/i18n';

import type { LocationPermissionState } from '../../lib/location';
import { getMessages } from '../../lib/i18n/messages';

export interface LocationRowState {
  /** Schalter steht auf „an“. */
  enabled: boolean;
  /** „ask“ fragt die App selbst, „settings“ öffnet die Handy-Einstellungen. */
  action: 'ask' | 'settings';
  detail: string;
}

/**
 * Erlaubt: Ausschalten geht nur in den Handy-Einstellungen.
 * Noch nicht entschieden: Die App darf selbst fragen.
 * Abgelehnt: Nur noch die Handy-Einstellungen helfen.
 */
export function locationRowState(
  permission: LocationPermissionState,
  locale: Locale = DEFAULT_LOCALE,
): LocationRowState {
  const m = getMessages(locale).profile.settings;
  switch (permission) {
    case 'granted':
      return { enabled: true, action: 'settings', detail: m.locationOn };
    case 'undetermined':
      return { enabled: false, action: 'ask', detail: m.locationAsk };
    case 'denied':
      return { enabled: false, action: 'settings', detail: m.locationDenied };
  }
}
