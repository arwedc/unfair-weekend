/**
 * Reine Logik für Push-Benachrichtigungen: Ziel eines Taps, Plattform und der Text im Profil.
 * Ohne React und ohne native Module, damit sie sich testen lässt.
 */
import type { PushPlatform } from '@repo/shared';
import { DEFAULT_LOCALE, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Wohin ein Tap auf die Benachrichtigung führt. Passt zu `data.url` aus der Edge Function send-push. */
export type PushTarget =
  | { pathname: '/angebot/[id]'; params: { id: string } }
  | { pathname: '/code/[id]'; params: { id: string } };

/**
 * Liest das Ziel aus `data.url` („/angebot/<uuid>“ oder „/code/<uuid>“).
 * Alles andere wird ignoriert, damit ein Push die App nicht auf beliebige Seiten schickt.
 */
export function pushTargetFromData(data: unknown): PushTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const url = (data as { url?: unknown }).url;
  if (typeof url !== 'string') return null;
  const match = /^\/(angebot|code)\/([^/?#]+)$/.exec(url.trim());
  const kind = match?.[1];
  const id = match?.[2];
  if (!kind || !id || !UUID.test(id)) return null;
  return kind === 'angebot'
    ? { pathname: '/angebot/[id]', params: { id } }
    : { pathname: '/code/[id]', params: { id } };
}

/** Plattform für `register_push_token`. Web bekommt in der App keine Pushes. */
export function pushPlatform(os: string): Extract<PushPlatform, 'ios' | 'android'> | null {
  if (os === 'ios') return 'ios';
  if (os === 'android') return 'android';
  return null;
}

/** Kann dieses Gerät überhaupt Pushes bekommen? */
export type PushAvailability =
  | 'ok'
  /** Expo Go kann keine Push-Nachrichten empfangen (nur Development- oder Store-Build). */
  | 'expo-go'
  /** Simulator oder Emulator ohne Push-Dienst. */
  | 'simulator'
  /** Build ohne EAS-Projekt-ID (`eas init` fehlt noch). */
  | 'no-project'
  | 'web';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export interface PushRowState {
  /** Schalter steht auf „an“. */
  enabled: boolean;
  /** Was ein Tap auf die Zeile tut. */
  action: 'toggle' | 'settings' | 'none';
  detail: string;
}

/** Zustand der Zeile „Benachrichtigungen“ im Profil. */
export function pushRowState(
  availability: PushAvailability,
  permission: PushPermission,
  optedOut: boolean,
  locale: Locale = DEFAULT_LOCALE,
): PushRowState {
  const m = getMessages(locale).logic.push;
  switch (availability) {
    case 'expo-go':
      return { enabled: false, action: 'none', detail: m.expoGo };
    case 'simulator':
      return { enabled: false, action: 'none', detail: m.simulator };
    case 'no-project':
      return { enabled: false, action: 'none', detail: m.noProject };
    case 'web':
      return { enabled: false, action: 'none', detail: m.web };
    case 'ok':
      break;
  }

  if (permission === 'denied') {
    return {
      enabled: false,
      action: 'settings',
      detail: m.denied,
    };
  }
  if (permission === 'granted' && !optedOut) {
    return {
      enabled: true,
      action: 'toggle',
      detail: m.on,
    };
  }
  return {
    enabled: false,
    action: 'toggle',
    detail: m.off,
  };
}
