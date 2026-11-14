# apps/mobile: App für Nutzer (Expo)

Zuständig: Tobias (@tobikl03). Anforderungen, Entscheidungen und Annahmen: [docs/SPEC-APP.md](../../docs/SPEC-APP.md). Die Regeln der Root-[CLAUDE.md](../../CLAUDE.md) gelten auch hier.

## Befehle

Unter Windows in PowerShell immer `pnpm.cmd` statt `pnpm` (die Execution Policy blockiert `pnpm.ps1`). Aus `apps/mobile`:

| Befehl                                 | Zweck                                                         |
| -------------------------------------- | ------------------------------------------------------------- |
| `pnpm.cmd start`                       | Metro starten, QR-Code mit Expo Go scannen                    |
| `pnpm.cmd start --tunnel`              | falls das Handy den PC im WLAN nicht erreicht                 |
| `pnpm.cmd typecheck` / `pnpm.cmd lint` | TypeScript und ESLint (inkl. React-Compiler-Regeln)           |
| `pnpm.cmd test`                        | Unit-Tests (Vitest) für die reine Logik in `src/features`     |
| `pnpm.cmd exec expo install <paket>`   | Bibliothek in der zum SDK passenden Version installieren      |
| `pnpm.cmd exec expo install --check`   | prüfen, ob alle Expo-Pakete zum SDK passen                    |
| `pnpm.cmd exec expo export -p ios`     | kompletten Bundle bauen (schneller Test, ob alles kompiliert) |

Vor jedem Commit aus dem Root: `pnpm.cmd check`.

Bibliotheken nie mit `pnpm add` in der neuesten Version holen, sondern mit `expo install`. Der Root hat eine Mindest-Alterregel für Pakete (`minimumReleaseAge`). Ist eine Version zu neu, die vorherige Patch-Version nehmen und nicht die Regel ändern.

## Aufbau

```
src/
  app/              nur Routen (Expo Router). (tabs)/ = die vier Tabs
  screens/          Inhalte der Screens, nach Bereich (feed/, venue/, map/, codes/ …).
                    venue/ = Standort-Seite; Angebote (/angebot/[id]) öffnen sie mit dem Angebot oben
  features/         Daten und Logik ohne Oberfläche, nach Bereich:
    offers/           api.ts (RPC-Aufrufe), queries.ts (TanStack-Query-Hooks),
                      feed-logic.ts (Filter, Abschnitte, Badges; mit Tests), filters-context.tsx
    map/              map-html.ts (Karte als Webseite für die WebView), map-logic.ts (Nadeln, Reihenfolge der Kacheln), pin-icons.ts (Kategorie-Symbol in der Nadel, Pfade passend zu category-icons.ts); mit Tests
    payments/         Zahlungen (Variante B, Flag payments_enabled): api.ts (Edge Functions stripe-*),
                      queries.ts (useBookingMode, Live-Buchung per Realtime), checkout-logic.ts (mit Tests),
                      stripe-provider.tsx (PaymentSheet, nur mit EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    push/             push.ts (Berechtigung, Token, An-/Abmelden), use-push.ts (Hooks),
                      push-logic.ts (Deep-Link-Ziel, Profilzeile; mit Tests)
    onboarding/       onboarding-context.tsx (gesehen, Wiederholen), onboarding-logic.ts (Pins aus echten
                      Koordinaten, Karten im Kreis), stage-math.ts (Kamera, Lage der Karte je Schritt); mit Tests
  components/ui/    Komponentenbibliothek: Text, Button, IconButton, Card, Chip, Badge, Input,
                    Sheet, Skeleton, EmptyState, SectionHeader, Screen, PressableScale
  components/offers/ fachliche Bausteine: OfferCard, OfferImage, PriceRow, FilterBar, ImageGallery
  components/onboarding/ eine durchgehende Szene statt drei Bildern: OnboardingStage (Kamera, Pins, Karten,
                    Drehen), PhotoPin, StageCard (Vorschau → großes Angebot → Karte im 3D-Kreis), CityMapArt
  lib/              supabase.ts, env.ts, query-client.ts, api-error.ts, open-external.ts, haptics.ts
  theme/            Brücke zu den Tokens aus @repo/shared
```

## Konventionen

- **Nur Bausteine aus `@/components/ui`.** Kein rohes `<Text>` aus react-native, keine eigenen Buttons in Screens. Fehlt etwas, die Bibliothek erweitern.
- **Farben, Abstände, Radien, Schatten, Schrift nur über `@/theme`** (`colors`, `space`, `layout`, `radius`, `radii`, `shadow`, `badge`, `fonts`, `textStyle()`). Keine Hex-Werte, keine Zahlen für Abstände außerhalb des Rasters.
- **Aus `@repo/shared`, nie nachbauen:** Typen (`Database`), Zod-Schemas, Kategorien und Labels, `parseRpcError`, `formatPrice`, `formatDiscount`, `formatDateTime`, `offerTimeLabel`, `seatsLabel`, `storageImageUrl`.
- **Supabase nur über `@/lib/supabase`.** Daten über die RPCs aus [docs/BACKEND.md](../../docs/BACKEND.md). Fehler immer über `toApiError`/`errorMessage` aus `@/lib/api-error` anzeigen (nutzt `parseRpcError`), nie `error.message` direkt.
- **Daten laden mit TanStack Query.** RPC-Aufrufe stehen in `features/<bereich>/api.ts`, Screens nutzen nur die Hooks aus `queries.ts`. Jeder Screen zeigt Laden (Skeleton), Fehler und Leerzustand (`EmptyState`).
- **Logik ohne React gehört nach `features/`** und bekommt Tests (`*.test.ts` daneben). Zeiten dabei immer über die Berlin-Helfer aus `@repo/shared`.
- **Karte:** MapLibre GL JS 5 in einer WebView (`features/map/map-html.ts`), Kacheln von OpenFreeMap. Die Quellenangabe ist eine feste Zeile in der Karte und muss sichtbar bleiben. Eine Nadel pro Adresse, keine Gruppen. Nur buchbare Angebote (freie Plätze) passend zu den Filtern. Tipp auf eine Nadel zeigt unten Kacheln (`components/map/MapOfferCarousel`), sortiert von West nach Ost; Wischen wechselt das Angebot, die Karte folgt.
- **Stadt:** Eine Stadt für Feed und Karte (`filters-context`). Beim App-Start wählt `useCityFromLocation` die Stadt des Standorts (ohne Erlaubnis: zuletzt gewählte). Wechseln von Hand nur in „Entdecken“; die Karte hat keine Städtewahl. Der Standort-Knopf der Karte setzt die Stadt wieder auf den Standort, der Feed springt mit.
- **Secrets:** In `apps/mobile/.env` stehen nur `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` und optional `EXPO_PUBLIC_MAP_STYLE_URL` und `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_…). Nie den Secret Key. Werte nie in Antworten ausgeben.
- **Expo Go muss laufen**, bis es Development Builds gibt (SPEC-APP, Annahme 1). Vor einer neuen Bibliothek prüfen, ob sie nativen Code braucht, der nicht in Expo Go steckt.
- **React Compiler ist an.** Shared Values von Reanimated mit `.get()`/`.set()` statt `.value`. Kein `setState` direkt im Effekt-Körper (Daten in einer Funktion laden und im `.then` setzen, mit Abbruch-Flag).
- **Push:** Die Erlaubnis wird nie beim Start abgefragt, sondern nach dem ersten geholten Code (`askForPushAfterClaim`) oder über den Schalter unter Profil → Einstellungen. Das Gerät meldet sich nach dem Login an (`register_push_token`) und vor dem Abmelden ab. Ein Tap öffnet `data.url` (`/angebot/<id>` oder `/code/<id>`), andere Pfade werden ignoriert. Der Android-Kanal heißt `default`, passend zu `send-push`. In Expo Go, im Simulator und ohne EAS-Projekt-ID passiert nichts; die Einstellungen erklären dann warum.
- **Zahlungen:** Ob gebucht oder bezahlt wird, entscheidet nur `useBookingMode()` (Flag aus = Code holen wie bisher). Bei Flag an führt „Platz buchen“ zu `/bezahlen/[id]`: reservieren, 10-Minuten-Timer, PaymentSheet, dann wartet die App per Realtime auf den Webhook und springt zum Code. In Expo Go nur Karte; Apple Pay und Google Pay brauchen einen Development Build.
- **Profil:** Unten stehen die Ordner Mitgliedschaft, Hilfe & Support, Geschenkkarte senden, Einstellungen und Rechtliches (`screens/profile/ProfileMenu.tsx`), jeder als eigene Stack-Seite mit großem Titel (`Page`). Einstellungen, Abmelden und Konto löschen gibt es nur dort. Das Profilbild liegt im privaten Bucket `avatars` und wird über eine signierte URL angezeigt (`features/profile/avatar-api.ts`). „Support kontaktieren“ sendet noch nichts, die E-Mail-Adresse in `lib/support.ts` ist ein Platzhalter.
- **Bottom Sheets** über `Sheet` (basiert auf `@expo/ui/community/bottom-sheet`), nicht `@gorhom/bottom-sheet`.
- **Tabs** sind native Tabs (`expo-router/native-tabs`). Keine selbstgebaute Tab-Leiste.
- **Bilder** mit `expo-image`. **Icons** in der App mit `lucide-react-native`, in der Tab-Leiste SF Symbols bzw. Material Symbols.
- **Haptik** nur über `haptics` aus `@/lib/haptics`, nie `expo-haptics` direkt. Leise dosiert: `selection` bei Auswahlwechsel, `tap` nur für Hauptaktionen (`Button haptic`), `success`/`error` für abgewartete Ergebnisse. Navigation, Links, Icon-Knöpfe und Scrollen bleiben still.
- **Barrierefreiheit:** jede Touch-Fläche mind. `layout.minTouchTarget`, `accessibilityRole` und Label setzen, „Bewegung reduzieren“ beachten (`useReducedMotion`).
- **Texte:** Deutsch, Du-Form, kurz. Emojis nur in Leerzuständen und Push-Nachrichten.

## Testen

- Expo Go auf dem iPhone: App „Expo Go“ aus dem App Store, PC und Handy im selben WLAN, `pnpm.cmd start` und den QR-Code mit der Kamera scannen.
- Testkonten: Seed-Konten aus BACKEND.md, Passwort `SEED_TEST_PASSWORD` aus der Root-`.env`. Eigene Testdaten mit Präfix „TEST App …“.

## Git

- Branches `app/...` für diesen Ordner, `db/...` für Migrationen und Edge Functions (eigener kleiner PR).
- Commit-Messages: `app: …` bzw. `db: …`, kurz und auf Deutsch.
