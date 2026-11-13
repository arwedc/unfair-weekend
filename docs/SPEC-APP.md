# Spezifikation: Mobile App für Nutzer

Ergänzt [SPEC.md](SPEC.md) (Gesamtprojekt) und [BACKEND.md](BACKEND.md) (Tabellen, RPCs, Fehlercodes). Wo diese Datei von SPEC.md abweicht, gilt für `apps/mobile` diese Datei. Geschäftsregeln stehen nur in SPEC.md und laufen nur auf dem Server.

**Zuständig für `apps/mobile`:** Tobias (@tobikl03). Er hat die App von Ben übernommen, Ben weiß Bescheid. Die Website in `apps/web` baut weiterhin @arwedc.

## 1. Ziel

Nutzer in Münster entdecken kurzfristige, vergünstigte Angebote lokaler Unternehmen (z. B. Kochkurse), holen sich einen Gutscheincode und lösen ihn vor Ort ein. Es gibt kein Payment. Der MVP soll die Nachfrage mit 5–15 Partnern testen. Plattformen: iOS und Android.

## 2. Tech-Stack

| Bereich       | Entscheidung                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | Expo SDK 58, TypeScript strict, Expo Router (Dateien in `src/app/`), React Compiler an                                                                                                                   |
| Monorepo      | pnpm-Workspace, Paket `@repo/mobile`. Metro erkennt das Monorepo selbst: keine `watchFolders`, kein `node-linker=hoisted`                                                                                |
| Gemeinsam     | Typen, Zod-Schemas, Kategorien, Fehlercodes (`parseRpcError`), Tokens, Preis-/Datums-/Zeitlabel-Helfer nur aus `@repo/shared`, nichts doppelt                                                            |
| Backend       | `@supabase/supabase-js`, Session verschlüsselt (AES-256) in AsyncStorage, Schlüssel in `expo-secure-store`                                                                                               |
| Navigation    | Native Tabs (`expo-router/native-tabs`): iOS mit Liquid Glass, Android mit Material 3                                                                                                                    |
| Bottom Sheets | `@expo/ui/community/bottom-sheet` (Expo-Ersatz mit der API von `@gorhom/bottom-sheet`, siehe Annahmen)                                                                                                   |
| Styling       | `StyleSheet`, alle Werte aus den Tokens über `src/theme` (siehe Annahmen)                                                                                                                                |
| Schrift       | Inter über `@expo-google-fonts/inter` (Schnitte 400–800, Namen aus `nativeFontFamily`)                                                                                                                   |
| Weitere       | `expo-image`, `react-native-reanimated`, `expo-haptics`, `lucide-react-native`, `react-native-qrcode-svg`, `expo-notifications`, `expo-apple-authentication`, Google-Login nach Supabase-Doku            |
| Karte         | Kacheln von OpenFreeMap (`tiles.openfreemap.org`), Stil „Positron“, Stil-URL über `EXPO_PUBLIC_MAP_STYLE_URL` änderbar. Attribution immer sichtbar: „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“ |
| Builds        | Expo Go zum Entwickeln. EAS-Profile `development` und `preview` sind angelegt, Development Builds folgen für Push (siehe Annahmen)                                                                       |

**Secrets:** In die App kommen nur `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Datei `apps/mobile/.env`, nie committen). Der Secret Key gehört nie in die App.

## 3. Was die App vom Backend nutzt

| Zweck                   | Aufruf                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Feed, Karte, Filter     | `list_offers(p_category, p_location_ids, p_only_available, p_limit, p_offset)`            |
| Angebotsdetail          | `get_offer(p_offer_id)`, dazu `log_offer_view(p_offer_id)` für die Kennzahlen             |
| Einstellungen (Fristen) | `get_settings()`: `cancel_deadline_hours`, `reminder_hours_before`, `block_days` …        |
| Konto                   | `get_my_account()`, `update_my_profile(p_first_name, p_last_name)`, `delete_my_account()` |
| Codes                   | `claim_voucher`, `cancel_voucher`, `get_my_vouchers`                                      |
| Favoriten               | direkt `favorite_locations` / `favorite_categories` (insert/delete, RLS: nur eigene)      |
| Push-Tokens             | `register_push_token`, `unregister_push_token`                                            |
| Fehler                  | Code aus `error.message` → `parseRpcError()` → deutscher Text aus `@repo/shared`          |

Die Events `code_geholt`, `code_storniert`, `code_eingeloest` und `no_show` schreibt das Backend selbst. Die App protokolliert nur „Angebot angesehen“ über `log_offer_view`.

**Für die App ergänzt (Migration `app_oeffentlich`):**

- `get_locations_public(p_location_ids)`: freigeschaltete Standorte mit Unternehmensinfo, für die Standortseite und die Lieblingsorte.
- `list_offer_created_at(p_offer_ids)`: Veröffentlichungszeit holbarer Angebote, für „Neu dabei“.

**Was noch fehlt (kommt als eigener kleiner DB-PR):**

1. **Push-Versand:** eine Edge Function, die die `notification_outbox` abarbeitet (pg_cron + pg_net, Secret Key aus Vault im `apikey`-Header, `verify_jwt = false`, `withSupabase({ auth: 'secret' })` aus `@supabase/server`), dazu ein RPC zum Abholen mit `FOR UPDATE SKIP LOCKED` (Vorlage in BACKEND.md).
2. **Neue Angebote an Favoriten:** ein Trigger auf neue Angebote schreibt Outbox-Einträge an Nutzer mit passendem Favorit (Standort oder Kategorie), höchstens einer pro Nutzer und Angebot. Dafür braucht das Enum `notification_type` einen neuen Wert. Bestehende RPCs bleiben unverändert.

Schon vorhanden und nicht nachzubauen: die Erinnerung vor Start (pg_cron-Job `unfair-enqueue-reminders`, einmal pro Code) und die Absage-Einträge aus `cancel_offer`.

## 4. Screens

Tabs: **Entdecken**, **Karte**, **Meine Codes**, **Profil**.

- **Entdecken (Feed):** Kategorie-Filter, Zeitfilter (Alle, Heute, Morgen, Wochenende), Abschnitte „Heute in Münster“, „Startet bald“ und „Neu dabei“ als horizontale Karussells, darunter alle Angebote sortiert nach „als Nächstes relevant“ (`relevant_at`). Badges: Rabatt in %, „startet in 2 Std.“, „noch 3 Plätze“, „ausgebucht“. Pull-to-Refresh.
- **Karte:** zentriert auf Münster, eigene minimalistische Pins mit dem Rabatt, Clustering. Ein Tipp auf einen Pin öffnet ein Bottom Sheet mit Vorschau, von dort geht es zum Detail. Gleiche Filter wie im Feed, optional der eigene Standort (mit Berechtigungsabfrage).
- **Angebotsdetail:** Bildergalerie, Originalpreis durchgestrichen, Deal-Preis, Rabatt, Zeit, freie Plätze, Beschreibung, Adresse mit „In Karten-App öffnen“, Link zur Standortseite, Platzwahl (1 bis `max_per_user`) und „Code holen“. Ohne Login geht es zum Login.
- **Standortseite:** Unternehmensinfo, aktive Angebote, Favorit-Button.
- **Meine Codes:** aktive und vergangene Codes. Im Detail: großer QR-Code (Bildschirmhelligkeit hoch), Kurzcode, Status und ein Storno-Button mit deutlich angezeigter Frist.
- **Profil:** Name bearbeiten, Lieblingskategorien, favorisierte Standorte, Push-Einstellungen, Datenschutz und Impressum (Platzhalter), Abmelden, Konto löschen (Pflicht im App Store).

## 5. Fachliche Regeln aus Sicht der App

Alle Regeln laufen serverseitig (SPEC.md). Die App zeigt sie verständlich an und übersetzt die Fehlercodes.

- Stöbern geht ohne Konto. Code holen braucht einen Login: E-Mail mit Einmal-Code, Sign in with Apple oder Google.
- Vor- und Nachname werden beim ersten Login abgefragt.
- Angebotsarten: `einzeltermin` (Start und Ende) und `zeitraum` (einlösbar von–bis).
- Code holen: 1 bis max. Plätze pro Nutzer, `claim_voucher` vergibt atomar. Pro Nutzer und Angebot gibt es höchstens einen aktiven Code.
- Storno: beim Einzeltermin bis `cancel_deadline_hours` vor Start, beim Zeitraum jederzeit.
- No-Show entsteht nur durch Markierung des Anbieters. Gesperrte Nutzer sehen beim Code-Holen einen klaren Hinweis mit dem Enddatum der Sperre.
- Code-Status: `aktiv`, `storniert`, `eingeloest`, `no_show`, `abgelaufen` (Texte aus `VOUCHER_STATUS_LABELS`).
- Zeiten immer in Europe/Berlin über die Helfer aus `@repo/shared`, nie über `toLocaleString()`.

## 6. Login

- **Jetzt (Entwicklung):** Dev-Login mit E-Mail und Passwort für die Seed-Konten (z. B. `seed-mia@example.com`, Passwort = `SEED_TEST_PASSWORD` aus der Root-`.env`). Er ist nur bei `__DEV__` sichtbar, also nie in Preview- oder Store-Builds.
- **E-Mail-Code (OTP):** braucht einen eigenen SMTP-Anbieter und eine Mailvorlage mit `{{ .Token }}`. Die Einrichtung macht Tobias mit einer Schritt-für-Schritt-Anleitung, sobald Phase 3 sie braucht.
- **Apple und Google:** Einrichtung (Apple Developer, Google Cloud, Supabase-Dashboard) in Phase 3. Sign in with Apple braucht ein Apple-Developer-Konto.

## 7. Push-Benachrichtigungen

- Berechtigung erst zu einem sinnvollen Zeitpunkt abfragen, z. B. direkt nach dem ersten geholten Code, nicht beim App-Start.
- Token nach dem Login über `register_push_token` speichern, mehrere Geräte pro Nutzer sind möglich. Beim Abmelden `unregister_push_token`.
- Versand über die Edge Function (siehe Abschnitt 3). Status in der Outbox pflegen, ungültige Tokens löschen.
- Arten: neues Angebot eines Favoriten, Erinnerung vor Start (Zeitpunkt aus `reminder_hours_before`, Standard 2 Std.), Absage.
- Ein Tipp auf einen Push öffnet den passenden Screen (Deep Link auf Angebot bzw. Code, Schema `unfairweekend://`).
- **Umsetzung:** Die App fragt nach dem ersten geholten Code einmal nach der Erlaubnis. Im Profil gibt es einen Schalter „Push-Nachrichten“. Ausschalten meldet das Gerät beim Server ab und merkt sich die Wahl auf dem Gerät. Wurde die Erlaubnis im System verweigert, führt die Zeile in die Handy-Einstellungen. Ein Tap öffnet `data.url` aus dem Push (`/angebot/<id>` oder `/code/<id>`).

## 8. Design

Eigene Identität. Wir übernehmen Prinzipien aus Deal-, Event- und Reise-Apps, aber nichts davon selbst: kein Logo, keine Markenfarben, keine Illustrationen, keine Texte, keine Namen. App und Website nutzen dieselben Tokens.

**Grundton:** lebendig und urban, macht Lust auf die eigene Stadt. Dazu klar wie eine gute Buchungs-App: wenige Elemente pro Screen, eine klare Hauptaktion. Preis, Rabatt und freie Plätze sind sofort lesbar.

**Prinzipien aus den Referenz-Screenshots** (Event-Feed, Reiseplaner, Buchungs-App, als Text festgehalten, nicht als Bild):

1. **Oben:** Ort (fest „Münster“) und darunter ein großes, pillenförmiges Suchfeld mit weichem Schatten. Daneben ein schlichtes Filter-Icon.
2. **Zeitfilter als Pillen:** eine Reihe Text-Pillen („Alle“, „Heute“, „Morgen“, „Wochenende“), die aktive Pille gefüllt in der Akzentfarbe, die anderen nur als Text.
3. **Kategorien mit Icon:** horizontal scrollbar, je Kategorie ein Lucide-Icon in einer hellgrauen, abgerundeten Kachel und das Label darunter. Die aktive Kategorie ist deutlich markiert.
4. **Abschnitte mit kräftigen Überschriften:** groß und fett („Heute in Münster“), rechts optional ein leiser Link „Alle“. Karussells lassen die nächste Karte am Rand anschneiden, damit klar ist, dass man wischen kann.
5. **Große Bildkarten:** Foto mit stark abgerundeten Ecken. Deal-Badges oben links direkt auf dem Bild, ein runder, halbtransparenter Favoriten-Button oben rechts. Unter dem Bild: Titel fett, dann eine graue Metazeile („Heute, 18:30 · Kreativkai“), dann die Preiszeile.
6. **Text auf Bild nur mit Verlauf:** Wo Text auf dem Foto steht (z. B. Karussell-Kacheln), sorgt ein dunkler Verlauf von unten (`imageScrim`) für Kontrast.
7. **Großzügige Abstände:** viel Weißraum zwischen den Abschnitten (`layout.sectionGap`), ruhiger grauer Fließtext, schwarze Überschriften.
8. **Tab-Leiste:** die native Leiste des Systems (auf iOS 26 schwebend mit Liquid Glass). Keine selbstgebaute Leiste.

**Bewusst nicht übernommen:** fremde Akzentfarben (wir nutzen „Glut“), Teilnehmerzahlen und Avatare, Sternebewertungen und Prädikate wie „Best in class“. Dafür gibt es im MVP keine Daten.

**Deals im Vordergrund:** Badges wie „−40 %“, „Nur heute“, „Noch 2 Plätze“ liegen auf dem Bild (`badge.deal`, `badge.urgent`, `badge.neutral`, `badge.soldOut`). Der alte Preis ist durchgestrichen, der Deal-Preis groß und kräftig (`textStyles.price`).

**Tonalität:** locker und direkt, in Du-Form, kurze Sätze. Emojis sparsam, z. B. in Leerzuständen oder Push-Nachrichten.

**Interaktion:** große Touch-Flächen (mind. 44 pt), Bottom Sheets statt Modals, sanfte Mikroanimationen (Rücksicht auf „Bewegung reduzieren“), Haptik bei wichtigen Aktionen (Code geholt, storniert), Skeleton-Loader, gestaltete Leer- und Fehlerzustände.

**Komponentenbibliothek** (`apps/mobile/src/components/ui`): Text, Button, Card, Chip, Badge, Input, Sheet, Skeleton, EmptyState, Screen, PressableScale. Screens bauen nur aus diesen Bausteinen.

## 9. Phasen

1. **Setup:** App im Monorepo, `@repo/shared` eingebunden, Tokens und Komponentenbibliothek, Tabs, Supabase-Client, EAS-Profile, Doku.
2. **Entdecken:** DB-PR Standortseite, Feed mit Filtern und Abschnitten, Angebotsdetail, Karte, Standortseite, alles mit den Seed-Daten.
3. **Login und Codes:** Dev-Login, E-Mail-Code, Apple, Google, Profil-Onboarding, Code holen, Meine Codes mit QR, Storno, Favoriten, Profil, Konto löschen.
4. **Push:** DB-PR (Outbox-Versand, neue Angebote an Favoriten), Tokens in der App, Deep Links, Test mit Development Build.
5. **Feinschliff:** Animationen und Zustände, Barrierefreiheit (Kontraste, Labels, dynamische Schrift), App-Icon und Splash als Platzhalter, Preview-Builds (Android-APK, iOS über TestFlight), README.

Am Ende jeder Phase: Typecheck, Lint, Tests, Commit und PR, kurze Zusammenfassung (gebaut, offen, Test auf dem Handy), dann auf das OK warten.

## 10. Datenbank-Regeln für die App-Arbeit

Es gilt die Root-[CLAUDE.md](../CLAUDE.md) mit diesen Abweichungen (Absprache vom 12.11.2026):

- Ablauf: `main` pullen → `pnpm supabase migration new <name> < /dev/null` → `pnpm db:check` → `pnpm supabase db push` → `pnpm db:types` → Commit auf Branch `db/<name>` → PR.
- Vor `db push` ins **Dev-Projekt** muss nicht nachgefragt werden. Ins **Live-Projekt** nie ohne OK.
- Supabase CLI v3, immer `--remote`. Kein Docker, kein `supabase start`, kein `db reset`, kein `db pull`/`db diff`.
- Bestehende Migrationen und RPCs werden nie geändert, es kommt nur Neues dazu.
- Eigene Testdaten tragen das Präfix „TEST App …“.

## 11. Annahmen

Getroffen, wo nichts festgelegt war. Wer etwas anders will, ändert es hier und sagt Bescheid.

1. **Expo Go statt Development Build (vorerst).** Tobias testet auf dem iPhone mit Expo Go und hat noch kein Apple-Developer-Konto. Ohne Konto gibt es keine iOS-Development-Builds. Bis zur Push-Phase bauen wir alles so, dass es in Expo Go läuft. Für Push braucht es dann ein Apple-Developer-Konto (iOS) oder ein Android-Gerät (Development Build per APK). `expo-dev-client` wird erst dann installiert, damit `expo start` bis dahin direkt Expo Go nutzt.
2. **Karte als eingebettete Web-Karte.** `@maplibre/maplibre-react-native` braucht nativen Code und läuft nicht in Expo Go. Deshalb zeigt die Karte MapLibre GL JS mit den OpenFreeMap-Kacheln in einer WebView. Mit dem ersten Development Build kann auf die native Bibliothek gewechselt werden. Kacheln, Stil und Attribution bleiben gleich.
3. **Bottom Sheets mit `@expo/ui` statt `@gorhom/bottom-sheet`.** `@gorhom/bottom-sheet` 5.2.14 ist für react-native-gesture-handler 2 gebaut, SDK 58 bringt Version 3 mit. Expo liefert unter `@expo/ui/community/bottom-sheet` einen Ersatz mit derselben API, der echte native Sheets nutzt und in Expo Go läuft. Nicht unterstützt sind eigene Backdrops und Handles; das System zeichnet sie.
4. **StyleSheet statt NativeWind.** StyleSheet braucht keinen zusätzlichen Build-Schritt und läuft sicher mit SDK 58 und in Expo Go. Alle Werte kommen aus den Tokens über `src/theme`. NativeWind lässt sich später ergänzen, ohne die Tokens zu ändern.
5. **Native Tabs statt JS-Tabs.** Die Tab-Leiste ist die echte Systemleiste (iOS 26 Liquid Glass, Android Material 3). Icons: SF Symbols auf iOS, Material Symbols auf Android. In der App selbst nutzen wir Lucide.
6. **Nur heller Modus.** Die Tokens haben nur `themes.light`. Die App erzwingt deshalb den hellen Modus (`userInterfaceStyle: light`). Ein dunkles Theme käme zuerst in `@repo/shared`.
7. **App-Name und Kennungen sind Platzhalter:** Anzeigename „unfair weekend“, Bundle-ID und Paketname `de.unfairweekend.app`, URL-Schema `unfairweekend`. Vor dem ersten Store-Build festlegen; die Bundle-ID lässt sich danach nicht mehr ändern.
8. **Suche läuft in der App.** `list_offers` hat keine Textsuche. Bei 5–15 Partnern durchsucht die App die geladenen Angebote (Titel, Standort, Unternehmen). Bei mehr Angeboten kommt ein Such-Parameter als neuer RPC dazu.
9. **Zeitfilter in der App.** „Heute“, „Morgen“ und „Wochenende“ filtert die App über `relevant_at` und die Datumshelfer (Europe/Berlin).
10. **„Neu dabei“** sind die zuletzt veröffentlichten Angebote. Das Veröffentlichungsdatum kommt aus `list_offer_created_at`, weil `list_offers` es nicht liefert und bestehende RPCs unverändert bleiben.
11. **Ort fest auf Münster.** Die Ortszeile oben ist eine Überschrift, kein Auswahlmenü. Es gibt nur Münster.
12. **Schriftgröße begrenzt.** Dynamische Schriftgrößen des Systems werden bis Faktor 1,6 übernommen (Badges bis 1,3), damit Karten nicht zerbrechen.
13. **Push-Schalter liegt auf dem Gerät.** Das Backend hat keine Push-Einstellung pro Nutzer. „Aus“ heißt deshalb: Das Gerät meldet seinen Token beim Server ab und merkt sich die Wahl lokal. Auf anderen Geräten desselben Kontos bleibt Push an. Eine Einstellung pro Konto (z. B. nur Erinnerungen) wäre eine neue Spalte samt RPC.
14. **Push nur mit EAS-Projekt.** Ohne `extra.eas.projectId` (kommt mit `eas init`) gibt es keinen Expo-Push-Token. Bis dahin meldet sich die App nicht an und erklärt im Profil, warum. In Expo Go gilt dasselbe.
