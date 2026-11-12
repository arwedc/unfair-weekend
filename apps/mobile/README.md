# apps/mobile: App für Nutzer (Expo)

**Zuständig:** Ben (@Mecrylol). Dieser Ordner ist ein Platzhalter. Die App entsteht in einer eigenen Claude-Code-Session, die hier eine eigene `CLAUDE.md` anlegt.

## Start

```bash
cd apps
pnpm create expo-app@latest mobile   # aktuelles SDK (zuletzt geprüft: SDK 58)
```

Danach in `apps/mobile/package.json`:

- `"name": "@repo/mobile"`
- `"@repo/shared": "workspace:*"` unter `dependencies`
- gemeinsame Versionen (z. B. `zod`, `typescript`) über `"catalog:"` beziehen

## Monorepo-Regeln aus der Expo-Doku

- Metro konfiguriert sich in Monorepos automatisch (`expo/metro-config`). Keine manuellen `watchFolders`/`nodeModulesPaths` eintragen.
- pnpm mit isolierten Abhängigkeiten wird ab SDK 54 unterstützt. Nur bei Problemen `nodeLinker: hoisted` in `pnpm-workspace.yaml` setzen. Das ist eine Root-Änderung und braucht deshalb einen eigenen PR.
- Nur **eine** Version von `react` und `react-native` im ganzen Repo. Prüfen mit `pnpm why --depth=10 react-native`.

## Anbindung

- `.env` in diesem Ordner: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Nie** den Secret Key.
- Backend-Vertrag (Tabellen, RPCs, Fehlercodes, Testzugänge): [docs/BACKEND.md](../../docs/BACKEND.md)
- Fehler aus RPCs: `parseRpcError(error)` aus `@repo/shared`, Eingaben mit den Zod-Schemas und `toRpcArgs()` prüfen
- Design: `import { tokens, themes, textStyles, badge } from '@repo/shared'`
  - Schrift: `@expo-google-fonts/inter`, Familiennamen je Gewicht in `nativeFontFamily`
  - Schatten: die Strings aus `shadows` direkt als `boxShadow`-Style nutzen
- Texte, Preise, Daten: `formatPrice`, `formatDateTime`, `offerTimeLabel`, `seatsLabel` aus `@repo/shared`

## Offene Backend-Aufgaben für die App-Session

- **E-Mail-OTP:** eigenes SMTP einrichten und die Vorlage „Magic Link“ auf `{{ .Token }}` umstellen (siehe BACKEND.md, Abschnitt 3)
- **Apple und Google:** Provider im Supabase-Dashboard konfigurieren
- **Push-Versand:** Worker für `notification_outbox` (Edge Function + RPC für `FOR UPDATE SKIP LOCKED`, siehe BACKEND.md, Abschnitt 10). Die RPC kommt als neue Migration.
