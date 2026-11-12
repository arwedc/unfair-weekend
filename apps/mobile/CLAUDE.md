# apps/mobile: App für Nutzer (Expo)

Zuständig: Tobias (@tobikl03). Anforderungen, Entscheidungen und Annahmen: [docs/SPEC-APP.md](../../docs/SPEC-APP.md). Die Regeln der Root-[CLAUDE.md](../../CLAUDE.md) gelten auch hier.

## Befehle

Unter Windows in PowerShell immer `pnpm.cmd` statt `pnpm` (die Execution Policy blockiert `pnpm.ps1`). Aus `apps/mobile`:

| Befehl                                 | Zweck                                                         |
| -------------------------------------- | ------------------------------------------------------------- |
| `pnpm.cmd start`                       | Metro starten, QR-Code mit Expo Go scannen                    |
| `pnpm.cmd start --tunnel`              | falls das Handy den PC im WLAN nicht erreicht                 |
| `pnpm.cmd typecheck` / `pnpm.cmd lint` | TypeScript und ESLint (inkl. React-Compiler-Regeln)           |
| `pnpm.cmd exec expo install <paket>`   | Bibliothek in der zum SDK passenden Version installieren      |
| `pnpm.cmd exec expo install --check`   | prüfen, ob alle Expo-Pakete zum SDK passen                    |
| `pnpm.cmd exec expo export -p ios`     | kompletten Bundle bauen (schneller Test, ob alles kompiliert) |

Vor jedem Commit aus dem Root: `pnpm.cmd check`.

Bibliotheken nie mit `pnpm add` in der neuesten Version holen, sondern mit `expo install`. Der Root hat eine Mindest-Alterregel für Pakete (`minimumReleaseAge`). Ist eine Version zu neu, die vorherige Patch-Version nehmen und nicht die Regel ändern.

## Aufbau

```
src/
  app/              nur Routen (Expo Router). (tabs)/ = die vier Tabs
  screens/          Inhalte der Screens, nach Bereich (feed/, offer/, codes/ …)
  components/ui/    Komponentenbibliothek: Text, Button, Card, Chip, Badge, Input,
                    Sheet, Skeleton, EmptyState, Screen, PressableScale
  components/       größere, fachliche Bausteine (OfferCard …)
  lib/              supabase.ts, env.ts, secure-session-storage.ts
  theme/            Brücke zu den Tokens aus @repo/shared
```

## Konventionen

- **Nur Bausteine aus `@/components/ui`.** Kein rohes `<Text>` aus react-native, keine eigenen Buttons in Screens. Fehlt etwas, die Bibliothek erweitern.
- **Farben, Abstände, Radien, Schatten, Schrift nur über `@/theme`** (`colors`, `space`, `layout`, `radius`, `radii`, `shadow`, `badge`, `fonts`, `textStyle()`). Keine Hex-Werte, keine Zahlen für Abstände außerhalb des Rasters.
- **Aus `@repo/shared`, nie nachbauen:** Typen (`Database`), Zod-Schemas, Kategorien und Labels, `parseRpcError`, `formatPrice`, `formatDiscount`, `formatDateTime`, `offerTimeLabel`, `seatsLabel`, `storageImageUrl`.
- **Supabase nur über `@/lib/supabase`.** Daten über die RPCs aus [docs/BACKEND.md](../../docs/BACKEND.md). Fehler immer über `parseRpcError(error)` anzeigen, nie `error.message` direkt.
- **Secrets:** In `apps/mobile/.env` stehen nur `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` und optional `EXPO_PUBLIC_MAP_STYLE_URL`. Nie den Secret Key. Werte nie in Antworten ausgeben.
- **Expo Go muss laufen**, bis es Development Builds gibt (SPEC-APP, Annahme 1). Vor einer neuen Bibliothek prüfen, ob sie nativen Code braucht, der nicht in Expo Go steckt.
- **React Compiler ist an.** Shared Values von Reanimated mit `.get()`/`.set()` statt `.value`. Kein `setState` direkt im Effekt-Körper (Daten in einer Funktion laden und im `.then` setzen, mit Abbruch-Flag).
- **Bottom Sheets** über `Sheet` (basiert auf `@expo/ui/community/bottom-sheet`), nicht `@gorhom/bottom-sheet`.
- **Tabs** sind native Tabs (`expo-router/native-tabs`). Keine selbstgebaute Tab-Leiste.
- **Bilder** mit `expo-image`. **Icons** in der App mit `lucide-react-native`, in der Tab-Leiste SF Symbols bzw. Material Symbols.
- **Barrierefreiheit:** jede Touch-Fläche mind. `layout.minTouchTarget`, `accessibilityRole` und Label setzen, „Bewegung reduzieren“ beachten (`useReducedMotion`).
- **Texte:** Deutsch, Du-Form, kurz. Emojis nur in Leerzuständen und Push-Nachrichten.

## Testen

- Expo Go auf dem iPhone: App „Expo Go“ aus dem App Store, PC und Handy im selben WLAN, `pnpm.cmd start` und den QR-Code mit der Kamera scannen.
- Testkonten: Seed-Konten aus BACKEND.md, Passwort `SEED_TEST_PASSWORD` aus der Root-`.env`. Eigene Testdaten mit Präfix „TEST App …“.

## Git

- Branches `app/...` für diesen Ordner, `db/...` für Migrationen und Edge Functions (eigener kleiner PR).
- Commit-Messages: `app: …` bzw. `db: …`, kurz und auf Deutsch.
