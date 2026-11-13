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

## Was du in Expo Go ausprobieren kannst

| Bereich     | So testest du es                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entdecken   | Feed scrollen, nach unten ziehen zum Aktualisieren, Suche („Pasta“), Zeitfilter und Kategorien antippen                                                                                                                                                                                                                                                                         |
| Angebot     | Karte antippen: Galerie wischen, „In Karten-App öffnen“, Anbieter antippen → Standortseite                                                                                                                                                                                                                                                                                      |
| Karte       | Tab „Karte“: Pins mit Rabatt, Gruppen antippen zum Hineinzoomen, Pin antippen → Vorschau von unten, Standort-Knopf (fragt nach der Erlaubnis)                                                                                                                                                                                                                                   |
| Konto       | Profil → „Anmelden“. Melde dich mit Google, Apple oder E-Mail und Passwort an. Neue Konten werden in zwei Schritten erstellt; Alter und Interessen sind optional. Wenn E-Mail-Bestätigung eingeschaltet ist, öffne den Bestätigungslink auf dem Gerät. In Expo Go gibt es unten den **Test-Login**: `seed-mia@example.com`, Passwort = `SEED_TEST_PASSWORD` aus der Root-`.env` |
| Code holen  | Angebot öffnen → „Code holen“ → Plätze wählen → bestätigen. Danach öffnet sich der Code mit QR (Bildschirm wird heller)                                                                                                                                                                                                                                                         |
| Meine Codes | Tab „Meine Codes“: aktive und vergangene Codes, im Detail „Stornieren“ (mit Frist)                                                                                                                                                                                                                                                                                              |
| Favoriten   | Standortseite → Herz oben rechts. Im Profil Lieblingskategorien wählen                                                                                                                                                                                                                                                                                                          |
| Profil      | Name ändern, Abmelden, Konto löschen (nur mit einem eigenen Test-Konto, nicht mit den Seed-Konten)                                                                                                                                                                                                                                                                              |

Fehler zum Ausprobieren: Flugmodus an → Feed zeigt „Kein Netz“ mit „Nochmal versuchen“.

## Login-Methoden einschalten

In `apps/mobile/.env` (Vorlage: [.env.example](.env.example)):

```bash
EXPO_PUBLIC_AUTH_EMAIL_OTP=1   # erst nach SMTP-Einrichtung (BACKEND.md, Abschnitt 3)
EXPO_PUBLIC_AUTH_APPLE=1       # erst nach Apple-Provider in Supabase
EXPO_PUBLIC_AUTH_GOOGLE=1      # erst nach Google-Provider in Supabase
```

Danach Expo neu starten (`Strg+C`, dann `pnpm.cmd start`).

## Monorepo-Regeln aus der Expo-Doku

- Metro konfiguriert sich in Monorepos automatisch (`expo/metro-config`). Keine manuellen `watchFolders`/`nodeModulesPaths` eintragen.
- pnpm mit isolierten Abhängigkeiten wird unterstützt. Kein `node-linker=hoisted`.
- Nur **eine** Version von `react` und `react-native` im ganzen Repo. Prüfen mit `pnpm why --depth=10 react-native`.

## Builds für Tester (später)

EAS-Profile stehen in [eas.json](eas.json): `development` (Development Build), `preview` (Android-APK bzw. iOS intern), `production`. Details: SPEC-APP.md, Annahme 1.

Einmalig: `eas.cmd login` und in `apps/mobile` `eas.cmd init` (legt das EAS-Projekt an).

- **Android-APK:** `eas.cmd build -p android --profile preview`. Am Ende gibt es einen Link bzw. QR-Code; Tester laden die APK und installieren sie (Installation aus unbekannten Quellen erlauben). Kein Google-Konto nötig.
- **iOS über TestFlight:** braucht ein Apple-Developer-Konto (99 €/Jahr). `eas.cmd build -p ios --profile production`, dann `eas.cmd submit -p ios`. In App Store Connect die Tester einladen; sie installieren die App über die TestFlight-App.
- Die Werte aus `apps/mobile/.env` landen nicht automatisch im Cloud-Build. Vor dem ersten Build die `EXPO_PUBLIC_…`-Variablen als EAS-Umgebungsvariablen anlegen (`eas.cmd env:set`, Sichtbarkeit `plaintext`), Umgebung `preview` bzw. `production`. Nur URL, Publishable Key und die Schalter, nie den Secret Key.

## Push-Benachrichtigungen testen

In Expo Go gibt es keine Push-Nachrichten. Das Profil zeigt dann „Kommt mit der fertigen App“. Zum Testen braucht es:

1. `eas init` in `apps/mobile` (legt das EAS-Projekt an und trägt `extra.eas.projectId` in die App-Konfiguration ein)
2. einen Development Build auf einem echten Gerät: Android per APK, iOS nur mit Apple-Developer-Konto
3. für Android zusätzlich die FCM-Zugangsdaten in EAS, für iOS den APNs-Schlüssel (fragt `eas build` beim ersten Mal ab)
4. auf dem Server die Edge Function `send-push` und die Vault-Secrets (siehe BACKEND.md, „send-push“)

Danach: anmelden, einen Code holen, die Erlaubnis bestätigen. Einen Push löst z. B. ein neues Angebot eines Lieblingsorts aus.

## Offene Aufgaben außerhalb der App

- **E-Mail-OTP:** eigenes SMTP einrichten und die Vorlage „Magic Link“ auf `{{ .Token }}` umstellen (siehe BACKEND.md, Abschnitt 3)
- **Apple und Google:** Provider im Supabase-Dashboard konfigurieren
- **Push:** `send-push` deployen und `pnpm db:push-secrets` ausführen (PR „db: Push-Versand über die Outbox“)
