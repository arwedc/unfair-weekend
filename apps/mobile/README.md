# apps/mobile: App für Nutzer (Expo)

**Zuständig:** Tobias (@tobikl03). Spezifikation: [docs/SPEC-APP.md](../../docs/SPEC-APP.md). Regeln für Claude Code: [CLAUDE.md](CLAUDE.md).

Expo SDK 58, Expo Router, TypeScript strict. Gemeinsamer Code kommt aus `@repo/shared`.

## Auf dem Handy testen (Expo Go)

1. Einmalig: Im Root `pnpm install` ausführen (Windows/PowerShell: `pnpm.cmd install`).
2. Einmalig: `apps/mobile/.env` nach der Vorlage [.env.example](.env.example) anlegen. Die Projekt-URL und den Publishable Key findest du im Supabase-Dashboard unter Project Settings → API.
3. Auf dem Handy die App **Expo Go** aus dem App Store bzw. Play Store installieren.
4. PC und Handy ins selbe WLAN.
5. In `apps/mobile` starten:

   ```bash
   pnpm start        # Windows/PowerShell: pnpm.cmd start
   ```

6. Den QR-Code im Terminal mit der Kamera (iPhone) bzw. in Expo Go (Android) scannen.

Verbindet sich das Handy nicht, mit `pnpm start --tunnel` starten (beim ersten Mal wird ein kleines Zusatzpaket installiert).

Änderungen am Code erscheinen nach dem Speichern sofort auf dem Handy. Mit `r` im Terminal lädt die App neu.

## Monorepo-Regeln aus der Expo-Doku

- Metro konfiguriert sich in Monorepos automatisch (`expo/metro-config`). Keine manuellen `watchFolders`/`nodeModulesPaths` eintragen.
- pnpm mit isolierten Abhängigkeiten wird unterstützt. Kein `node-linker=hoisted`.
- Nur **eine** Version von `react` und `react-native` im ganzen Repo. Prüfen mit `pnpm why --depth=10 react-native`.

## Builds (später)

EAS-Profile stehen in [eas.json](eas.json): `development` (Development Build), `preview` (Android-APK bzw. iOS intern), `production`. Für iOS-Builds braucht es ein Apple-Developer-Konto. Details: SPEC-APP.md, Annahme 1.

## Offene Backend-Aufgaben

- **E-Mail-OTP:** eigenes SMTP einrichten und die Vorlage „Magic Link“ auf `{{ .Token }}` umstellen (siehe BACKEND.md, Abschnitt 3)
- **Apple und Google:** Provider im Supabase-Dashboard konfigurieren
- **Standortseite:** öffentlicher RPC für Standort und Unternehmensinfo (Phase 2)
- **Push-Versand:** Worker für `notification_outbox` (Edge Function + RPC mit `FOR UPDATE SKIP LOCKED`, siehe BACKEND.md, Abschnitt 10) und Trigger für neue Angebote an Favoriten (Phase 4)
