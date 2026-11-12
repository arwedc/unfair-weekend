# unfair-weekend

Plattform für kurzfristige, vergünstigte Angebote lokaler Unternehmen in Münster (z. B. Kochkurse). Nutzer sichern sich Angebote per Gutscheincode, ohne Payment und ohne Gebühren. MVP-Test mit 5–15 Partnern.

- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron). Dev-Projekt in Paris (eu-west-3), Live später in Frankfurt
- **Website** für Unternehmen und Admin: Next.js in `apps/web` (@arwedc)
- **App** für Nutzer: Expo in `apps/mobile` (Ben, @Mecrylol)

Vollständige Anforderungen, Entscheidungen und Annahmen: [docs/SPEC.md](docs/SPEC.md). Backend-Vertrag (Tabellen, RPCs, Fehlercodes): `docs/BACKEND.md` (entsteht in Phase 4).

## Projektstruktur

```text
apps/
  mobile/            Expo-App (Ben). Eigene CLAUDE.md.
  web/               Next.js-Website (@arwedc). Eigene CLAUDE.md.
packages/
  shared/            @repo/shared: Typen, Zod-Schemas, Konstanten, Design-Tokens, Hilfsfunktionen
    src/constants/   Kategorien, Statuswerte, Fehlercodes
    src/tokens/      Design-Tokens (Farben, Abstände, Radien, Schatten, Typografie)
    src/utils/       Preise, Rabatte, Datum (Europe/Berlin), Zeitlabels
tooling/db/          @repo/db-tools: Probelauf, SQL-Test-Runner, Typgenerierung, Seed
supabase/
  migrations/        Schema als Migrationsdateien (einzige Quelle der Wahrheit)
  functions/         Edge Functions
  tests/             SQL-Tests (pgTAP)
  config.toml        CLI-Konfiguration (wir starten KEIN lokales Supabase)
docs/                SPEC.md, BACKEND.md, design-referenz/
```

## Befehle

| Befehl                                            | Zweck                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                    | Abhängigkeiten installieren (nach jedem Pull von `main`)                                                |
| `pnpm check`                                      | Alles prüfen: Format, Lint, Typecheck, Unit-Tests                                                       |
| `pnpm typecheck` / `pnpm lint` / `pnpm test`      | einzeln                                                                                                 |
| `pnpm format`                                     | Prettier auf alles anwenden                                                                             |
| `pnpm supabase <befehl>`                          | Supabase CLI aus dem Repo (gleiche Version für alle)                                                    |
| `pnpm supabase migration new <name> < /dev/null`  | neue, leere Migrationsdatei anlegen (siehe Hinweis unten)                                               |
| `pnpm supabase db push --remote --yes`            | Migrationen ins Dev-Projekt spielen (nach `pnpm db:check`, siehe feste Regel unten)                     |
| `pnpm db:check`                                   | Probelauf: offene Migrationen in einer Transaktion einspielen und zurückrollen                          |
| `pnpm db:test`                                    | wie `db:check`, danach alle SQL-Tests (`supabase/tests/*.test.sql`), alles zurückgerollt                |
| `pnpm db:test -- claim`                           | nur Testdateien, deren Name „claim“ enthält                                                             |
| `pnpm db:types`                                   | Typen aus dem Dev-Projekt nach `packages/shared/src/types/database.types.ts`                            |
| `pnpm db:test:race`                               | echtes Wettrennen: 10 parallele Anfragen auf den letzten Platz (temporäre Daten, danach aufgeräumt)     |
| `pnpm db:seed`                                    | Seed einspielen: Testkonten + `supabase/seed.sql`, idempotent (**nur nach ausdrücklicher Bestätigung**) |
| `pnpm supabase functions deploy <name> --use-api` | Edge Function deployen, ohne Docker (**nur nach ausdrücklicher Bestätigung**)                           |

Paket-Befehle gezielt: `pnpm --filter @repo/shared test`.

**Fallstricke der Supabase CLI v3:**

- Ohne `--remote` zielt sie auf ein lokales Supabase (Docker). Gegen das Dev-Projekt immer `--remote` angeben.
- `migration new` liest den SQL-Inhalt aus stdin, wenn keine Konsole angeschlossen ist (z. B. in Claude Code). Ohne `< /dev/null` bleibt sie hängen.
- Befehle, die die Datenbank brauchen, lesen das Passwort aus der Umgebungsvariable `SUPABASE_DB_PASSWORD`. Die `.env` lädt die CLI nicht selbst, deshalb vorher `set -a && source .env && set +a` ausführen. Die `pnpm db:*`-Skripte laden die `.env` selbst.

## Konventionen

- **Sprache:** Oberfläche, Fehlermeldungen, Doku und Kommentare auf Deutsch. Bezeichner (Tabellen, Spalten, Funktionen, Variablen) auf Englisch in snake_case (SQL) bzw. camelCase (TS). Statuswerte so wie in der DB (`aktiv`, `storniert`, `eingeloest`, `no_show`, `abgelaufen`), ASCII ohne Umlaute.
- **Geld:** immer ganze Cent (EUR) als Integer, Spalten heißen `*_cents`. Anzeige nur über `formatPrice()`.
- **Zeit:** in der DB `timestamptz` (UTC). Angezeigt wird immer in Europe/Berlin, nur über die Helfer in `@repo/shared` (`formatDateTime`, `offerTimeLabel` …), nie über `toLocaleString()` des Geräts.
- **Geschäftsregeln laufen nur serverseitig** in Postgres-Funktionen (RPCs). Clients validieren mit den Zod-Schemas aus `@repo/shared` nur für schnelles Feedback. Die Wahrheit liegt im Server.
- **Fehler aus RPCs** kommen als fester Code in `message` (z. B. `AUSGEBUCHT`, `GESPERRT`, `FRIST_ABGELAUFEN`). App und Web übersetzen sie über die Codes in `@repo/shared`, nie über freie Texte. Ein neuer Code kommt immer gleichzeitig in die DB und nach `packages/shared` (mit deutschem Text).
- **`@repo/shared` ist plattformneutral:**
  - kein DOM, kein Node, kein React (ESLint erzwingt das)
  - einzige Laufzeit-Abhängigkeit ist zod
  - exportiert TypeScript-Quellcode ohne Build-Schritt
- **TypeScript strict** (inkl. `noUncheckedIndexedAccess`). Kein `any`, keine `@ts-ignore` ohne Begründung.
- **Design:**
  - Komponenten nutzen nur semantische Tokens (`themes.light.text.primary`, `accent.solid`, `badge.deal` …), keine Hex-Werte.
  - Keine Logos, Farben, Illustrationen oder Texte anderer Apps.
  - Akzent „Glut“: `#FF5A1F` (Markenton) und `#D63A0A` (Flächen mit weißem Text).
- **Gemeinsame Versionen** (zod, typescript …) stehen im Catalog in `pnpm-workspace.yaml`. In Paketen `"catalog:"` verwenden. React/React Native darf es nur in einer Version geben (Expo-Vorgabe).
- **Tests:** Vitest für `packages/shared` (neben der Datei: `*.test.ts`), pgTAP für SQL (`supabase/tests/`).

## Supabase: kein lokales Supabase, kein Docker

Wir entwickeln beide direkt gegen **ein gemeinsames Dev-Projekt in der Cloud**. Jede Schemaänderung wirkt sofort beim anderen. Docker wird nirgends benötigt und auch nicht als Option genutzt.

- **Schemaänderungen nie im Dashboard klicken**, immer als Migrationsdatei in `supabase/migrations/`.
- **Nur hinzufügen:** Neue Tabellen, Spalten und Funktionen sind okay. Umbenennen, Löschen oder Ändern bestehender Strukturen nur nach Absprache mit dem anderen.
- **Bestehende Migrationen werden nie geändert**, es kommen nur neue dazu.
- **Feste Regel für DB-Änderungen im Dev-Projekt** (gilt seit 12.11.2026):
  1. Jede Änderung an Schema, RLS, Funktionen, Triggern, Cron oder Storage ist eine **neue Migrationsdatei** in `supabase/migrations/` (`pnpm supabase migration new <name>`). Das Schema wird nie direkt per MCP oder SQL geändert.
  2. Vor dem Einspielen läuft `pnpm db:check` (Probelauf mit Rollback). Schlägt er fehl, wird die Migration korrigiert und **nicht** gepusht.
  3. Danach spielt Claude **ohne Rückfrage** ein: `pnpm supabase db push --remote --yes`. Anschließend werden die Typen neu erzeugt (`pnpm db:types`).
  4. Migration und Typen sofort committen, auf einen Branch `db/<kurzname>` pushen und Ben den PR-Link geben. Ben merged selbst.
  5. Ben bekommt eine Zusammenfassung in zwei Sätzen, was sich geändert hat (zum Weitergeben an @arwedc).
  6. **Das gilt nur für das Dev-Projekt.** Für ein späteres Live-Projekt braucht jeder `db push` Bens ausdrückliches OK.
- Erst nach dem Push und den neuen Typen das Feature bauen, das die Änderung nutzt.
- **CLI v3:** Ohne `--remote` zielt die Supabase CLI auf ein lokales Supabase (Docker). Befehle gegen das Dev-Projekt deshalb immer mit `--remote`, z. B. `pnpm supabase migration list --remote`.
- **Nie die Datenbank zurücksetzen** (`db reset`, `drop schema` o. ä.), ohne dass beide zugestimmt haben.
- **Hat doch jemand im Dashboard geklickt:** `db pull`/`db diff` brauchen Docker, deshalb nicht verwenden. Stattdessen liest Claude den Ist-Zustand lesend aus (Katalogabfragen über `SUPABASE_DB_URL` oder Supabase-MCP im Read-only-Modus) und schreibt eine neue Migration von Hand, die genau diesen Zustand beschreibt (idempotent, z. B. `if not exists`).
- **Supabase-MCP-Server nur lesend** (`read_only=true`). Schreibende Änderungen laufen ausschließlich über Migrationsdateien und die CLI.
- **Testdaten** tragen ein erkennbares Präfix, z. B. „TEST Ben …“ oder „TEST Arwed …“. Seed-Daten nicht verändern.
- **Nach jedem Pull von `main`:** `pnpm install` und die Typen prüfen bzw. mit `pnpm db:types` neu generieren.
- **Neue Tabellen:** RLS aktivieren, Grants explizit setzen, Policies für alle drei Rollen (Nutzer, Standort, Admin) durchdenken, Indizes auf Policy- und FK-Spalten.
- **Funktionen mit `security definer`** immer mit `set search_path = ''` und voll qualifizierten Namen. Helfer liegen im nicht exponierten Schema `private`.

## Zusammenarbeit (zwei Entwickler parallel)

**Zuständigkeiten**

- Ben (@Mecrylol): `apps/mobile`
- @arwedc: `apps/web`
- Jeder arbeitet auf seinem eigenen Rechner mit einer eigenen Claude-Code-Session.

**Git und GitHub**

- `main` ist geschützt, Änderungen kommen nur per Pull Request.
- Branches: `app/...` (Mobile), `web/...` (Website), `db/...` (Migrationen und Typen), `backend/...` (shared, tooling, Root).
- Kleine PRs, oft mergen. `main` mindestens täglich in den eigenen Branch holen.
- **Eigene Ordner** (`apps/mobile` bzw. `apps/web`) darf jeder frei ändern.
- **Datenbank** (`supabase/`): Migrations-PRs auf `db/...` brauchen kein Review, Ben merged sie selbst. Die Änderung ist zu diesem Zeitpunkt schon im Dev-Projekt (siehe Regel oben), @arwedc wird über die Zwei-Satz-Zusammenfassung informiert.
- **Andere gemeinsame Bereiche** (`packages/`, `tooling/`, Root-Konfiguration, `docs/`, `.github/`):
  - Änderungen nur in einem eigenen, kleinen PR, den der andere kurz reviewt
  - keine gemeinsamen Änderungen nebenbei in einem Feature-PR verstecken
- Commit-Messages: kurz, Deutsch, mit Bereich vorne, z. B. `shared: Zeitlabel für Zeiträume`, `backend: claim_voucher`, `app: Feed-Screen`.
- PR-Vorlage mit Checkliste: `.github/pull_request_template.md`.

**Secrets**

- Nur in `.env`-Dateien, nie committen. Vorlage: `.env.example` (Root), dazu `apps/web/.env.local` und `apps/mobile/.env`.
- Das Repo ist **öffentlich**: keine Passwörter, Keys, Projekt-Refs oder echten Personendaten in Code, Doku oder Seed.
- Der Secret Key (`sb_secret_…`) gehört nur in lokale Skripte und Server-Code, nie in die App oder in `NEXT_PUBLIC_`-Variablen.
- Später kommt ein zweites Supabase-Projekt für den Live-Betrieb. Deshalb sind alle URLs und Keys über `.env` austauschbar. Nichts hart codieren.

## Checkliste für Claude Code

- Zu Beginn: `git pull` auf `main` bzw. `main` in den Branch holen, `pnpm install`.
- `supabase db push` ins **Dev-Projekt** nach erfolgreichem `pnpm db:check` ohne Rückfrage (feste Regel oben). Ins **Live-Projekt** nur mit Bens ausdrücklichem OK.
- Vor dem Einspielen von Seeds, vor Edge-Function-Deploys und vor allem anderen, was Daten im Dev-Projekt dauerhaft ändert: **ausdrücklich nachfragen**.
- Nach Schemaänderungen: Typen neu generieren, `docs/BACKEND.md` und die Fehlercodes in `packages/shared` aktualisieren.
- Vor dem Commit: `pnpm check`. Bei DB-Änderungen zusätzlich `pnpm db:check` bzw. `pnpm db:test`.
- Zur Supabase-, Expo- und Next.js-API die aktuelle offizielle Doku prüfen, nicht aus dem Gedächtnis arbeiten.
- Skills `supabase` und `postgres-best-practices` für Schema, RLS und Funktionen nutzen, falls installiert.
