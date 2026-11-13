/**
 * Schwebender Tools-Button von Expo (das blaue Zahnrad) in Expo Go und Development Builds.
 *
 * Er verdeckt oben die Kopfzeile. Wir blenden ihn beim Start aus. Das Entwicklermenü bleibt
 * per Schütteln erreichbar, dort lässt sich der Button auch wieder einschalten.
 * In Release-Builds gibt es ihn ohnehin nicht.
 *
 * Kein zusätzliches Paket: Wir sprechen das native Modul `ExpoDevMenu` direkt an
 * (das macht `expo-dev-menu` intern genauso). Fehlt es, passiert einfach nichts.
 */
import { requireOptionalNativeModule } from 'expo';

interface ExpoDevMenuModule {
  setToolsButtonVisible?: (visible: boolean) => Promise<void> | void;
}

export function hideDevToolsButton(): void {
  if (!__DEV__) return;
  try {
    const devMenu = requireOptionalNativeModule<ExpoDevMenuModule>('ExpoDevMenu');
    void Promise.resolve(devMenu?.setToolsButtonVisible?.(false)).catch(() => {
      // Ältere Expo-Go-Versionen kennen die Funktion nicht. Nicht schlimm.
    });
  } catch {
    // Nur ein Entwickler-Komfort, darf die App nie stören.
  }
}
