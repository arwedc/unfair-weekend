import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptik der App. Bewusst leise: Sie bestätigt, was der Finger gerade getan hat, und soll
 * dabei nicht auffallen. Deshalb gibt es nur wenige Arten und nicht jeder Tipp bekommt eine.
 *
 * - `selection`: Auswahl wechselt (Chip, Tab, Stern, Kachel rastet ein, Rad dreht weiter)
 * - `tap`: wichtige Aktion ausgelöst („Code holen“, „Bezahlen“), leichter als ein Knopfdruck
 * - `land`: etwas setzt sichtbar auf (Stempel), weich gedämpft
 * - `success` / `error`: Ergebnis einer Aktion, auf die man gewartet hat
 *
 * Still bleiben: Navigation, Links, Icon-Knöpfe, Scrollen und reine Eingabefelder.
 * Auf iOS schaltet „Systemhaptik“ in den Einstellungen alles ab. Android nutzt die
 * Haptik-Engine des Systems (kurzes Klicken statt Vibrationsmotor).
 */

/** Kürzester Abstand zwischen zwei leisen Rückmeldungen, damit nichts zu einem Brummen verschmilzt. */
const MIN_GAP_MS = 60;
let lastFired = 0;

function fire(ios: () => Promise<void>, android: Haptics.AndroidHaptics, always = false): void {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  // Ergebnisse (Erfolg, Fehler) kommen immer an, leise Ticks werden gedrosselt.
  if (!always && now - lastFired < MIN_GAP_MS) return;
  lastFired = now;
  const run = Platform.OS === 'android' ? () => Haptics.performAndroidHapticsAsync(android) : ios;
  void run().catch(() => undefined);
}

export const haptics = {
  selection: () => fire(Haptics.selectionAsync, Haptics.AndroidHaptics.Clock_Tick),
  tap: () =>
    fire(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      Haptics.AndroidHaptics.Virtual_Key,
    ),
  land: () =>
    fire(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
      Haptics.AndroidHaptics.Context_Click,
    ),
  success: () =>
    fire(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      Haptics.AndroidHaptics.Confirm,
      true,
    ),
  error: () =>
    fire(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      Haptics.AndroidHaptics.Reject,
      true,
    ),
};
