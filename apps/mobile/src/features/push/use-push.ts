/** React-Anbindung für Push: Einrichtung im Root-Layout und der Schalter im Profil. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import {
  configureNotificationHandler,
  ensureAndroidChannel,
  getPushPermission,
  isPushOptedOut,
  pushAvailability,
  registerDevice,
  setPushEnabled,
} from './push';
import { pushRowState, pushTargetFromData } from './push-logic';

/** Schon geöffnete Benachrichtigungen, damit ein Tap nicht zweimal navigiert. */
const handled = new Set<string>();

function openFromResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);
  const target = pushTargetFromData(response.notification.request.content.data);
  if (target) router.push(target);
}

/**
 * Einmal im Root-Layout, nachdem der Stack steht:
 * Anzeige-Regeln, Android-Kanal, Tap auf eine Benachrichtigung öffnet Angebot oder Code,
 * und nach dem Anmelden wird das Gerät beim Server registriert (falls erlaubt).
 */
export function usePushSetup(userId: string | null): void {
  useEffect(() => {
    configureNotificationHandler();
    void ensureAndroidChannel().catch(() => undefined);

    // App wurde durch einen Tap gestartet
    openFromResponse(Notifications.getLastNotificationResponse());
    // Tap, während die App läuft oder im Hintergrund ist
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!userId) return;
    void registerDevice().catch(() => false);
  }, [userId]);
}

const pushStatusKey = ['push-status'] as const;

/** Stand für die Profilzeile. Lädt neu, wenn die App wieder in den Vordergrund kommt. */
export function usePushStatus() {
  return useQuery({
    queryKey: pushStatusKey,
    queryFn: async () => {
      const availability = pushAvailability();
      if (availability !== 'ok') return pushRowState(availability, 'undetermined', false);
      const [permission, optedOut] = await Promise.all([getPushPermission(), isPushOptedOut()]);
      return pushRowState(availability, permission, optedOut);
    },
    staleTime: 0,
  });
}

export function useSetPushEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setPushEnabled,
    onSettled: () => queryClient.invalidateQueries({ queryKey: pushStatusKey }),
  });
}
