/**
 * Push-Benachrichtigungen auf dem Gerät: Berechtigung, Expo-Push-Token, An- und Abmelden beim Server.
 *
 * Verschickt wird serverseitig (Edge Function send-push, siehe docs/BACKEND.md). Die App meldet hier
 * nur ihr Gerät an (`register_push_token`) und wieder ab (`unregister_push_token`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushTokenSchema } from '@repo/shared';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

import { pushPlatform, type PushAvailability, type PushPermission } from './push-logic';

/** Muss zu `channelId` in supabase/functions/send-push passen. */
export const ANDROID_CHANNEL_ID = 'default';

const TOKEN_KEY = 'push.token';
const OPT_OUT_KEY = 'push.optOut';
/** Abmelden soll nicht hängen, wenn das Netz weg ist. */
const UNREGISTER_TIMEOUT_MS = 3000;

function easProjectId(): string | null {
  // Laut Expo-Doku: erst app.json (extra.eas.projectId, setzt `eas init`), dann die EAS-Build-Konfiguration.
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const easConfig = Constants.easConfig as unknown as { projectId?: unknown } | null | undefined;
  const id = extra?.eas?.projectId ?? easConfig?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function pushAvailability(): PushAvailability {
  if (Platform.OS === 'web') return 'web';
  if (isRunningInExpoGo()) return 'expo-go';
  if (!Device.isDevice) return 'simulator';
  if (!easProjectId()) return 'no-project';
  return 'ok';
}

/** Wie Benachrichtigungen erscheinen, während die App offen ist: als Banner mit Ton. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}

/** Android braucht einen Kanal, bevor die Berechtigung abgefragt wird (ab Android 13). */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Angebote und Codes',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.accent.solid,
  });
}

function toPermission(status: string): PushPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return toPermission(status);
}

/** Zeigt die System-Abfrage (nur, wenn noch nie gefragt wurde; sonst liefert sie den Stand). */
export async function requestPushPermission(): Promise<PushPermission> {
  await ensureAndroidChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return toPermission(status);
}

export async function isPushOptedOut(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OPT_OUT_KEY)) === '1';
  } catch {
    return false;
  }
}

async function setPushOptedOut(value: boolean): Promise<void> {
  if (value) await AsyncStorage.setItem(OPT_OUT_KEY, '1');
  else await AsyncStorage.removeItem(OPT_OUT_KEY);
}

/**
 * Meldet das Gerät beim Server an. Tut nichts ohne echtes Gerät, Berechtigung oder EAS-Projekt.
 * Braucht eine angemeldete Session. Liefert true, wenn ein Token gespeichert wurde.
 */
export async function registerDevice(): Promise<boolean> {
  const projectId = easProjectId();
  const platform = pushPlatform(Platform.OS);
  if (pushAvailability() !== 'ok' || !projectId || !platform) return false;
  if (await isPushOptedOut()) return false;
  if ((await getPushPermission()) !== 'granted') return false;

  await ensureAndroidChannel();
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const parsed = pushTokenSchema.safeParse({ token, platform });
  if (!parsed.success) return false;

  const { error } = await supabase.rpc('register_push_token', {
    p_token: parsed.data.token,
    p_platform: parsed.data.platform,
  });
  if (error) return false;
  await AsyncStorage.setItem(TOKEN_KEY, parsed.data.token);
  return true;
}

/**
 * Meldet das Gerät beim Server ab, solange die Session noch gilt (vor dem Abmelden aufrufen).
 * Wirft nie: Ohne Netz bleibt der Token auf dem Server, bis sich jemand anderes auf dem Gerät
 * anmeldet (`register_push_token` übernimmt ihn dann) oder Expo ihn als ungültig meldet.
 */
export async function unregisterDevice(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await Promise.race([
      supabase.rpc('unregister_push_token', { p_token: token }),
      new Promise((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
    ]);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // bewusst ignoriert, Abmelden darf daran nicht scheitern
  }
}

/** Nur den gespeicherten Token vergessen, z. B. nach dem Löschen des Kontos (Server hat ihn schon gelöscht). */
export async function forgetDevice(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // bewusst ignoriert
  }
}

/**
 * Nach dem ersten geholten Code: einmal nach der Erlaubnis fragen (passender Moment, weil es
 * dann um die Erinnerung vor dem Start geht). Fragt nie zweimal und nie, wenn ausgeschaltet.
 */
export async function askForPushAfterClaim(): Promise<void> {
  try {
    if (pushAvailability() !== 'ok' || (await isPushOptedOut())) return;
    if ((await getPushPermission()) !== 'undetermined') return;
    if ((await requestPushPermission()) === 'granted') await registerDevice();
  } catch {
    // bewusst ignoriert, Code holen ist schon geklappt
  }
}

/** Schalter im Profil. Liefert den neuen Stand der Berechtigung. */
export async function setPushEnabled(enabled: boolean): Promise<PushPermission> {
  if (!enabled) {
    await setPushOptedOut(true);
    await unregisterDevice();
    return getPushPermission();
  }
  await setPushOptedOut(false);
  const permission = await requestPushPermission();
  if (permission === 'granted') await registerDevice();
  return permission;
}
