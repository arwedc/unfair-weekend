# AGENTS.md

Anweisungen für KI-Coding-Agents außer Claude Code (z. B. OpenAI Codex, ChatGPT, Cursor). Claude Code liest `CLAUDE.md` automatisch, andere Agents lesen diese Datei.

## Zuerst lesen

1. **[CLAUDE.md](CLAUDE.md):** verbindliche Regeln, Befehle, Konventionen und Zusammenarbeit. Gilt für alle Agents, nicht nur für Claude. Bei Widersprüchen gilt `CLAUDE.md`.
2. **[docs/BACKEND.md](docs/BACKEND.md):** Backend-Vertrag mit Tabellen, RPCs (Parameter, Rückgaben, Fehlercodes), Rechten pro Rolle, Auth, Storage und Testzugängen. Vor jeder Arbeit an Daten, Auth oder Supabase lesen.
3. **`apps/mobile/CLAUDE.md` bzw. `apps/web/CLAUDE.md`**, falls vorhanden: Regeln der jeweiligen App.

Das Repo ist ein pnpm-Monorepo: `apps/mobile` (Expo, Ben), `apps/web` (Next.js, Arwed), `packages/shared` (`@repo/shared`), `tooling/db`, `supabase/`.

## Harte Regeln (Kurzfassung, Details in CLAUDE.md)

- **Kein Docker, kein lokales Supabase.** Nie `supabase start`, `db reset`, `db pull`, `db diff` oder `test db`. Wir arbeiten direkt gegen das gemeinsame Dev-Projekt in der Cloud.
- **Supabase CLI v3** immer über `pnpm supabase …` aufrufen und gegen das Dev-Projekt immer mit `--remote`. Neue Migrationsdatei: `pnpm supabase migration new <name> < /dev/null`.
- **Schema nur per Migrationsdatei** in `supabase/migrations/`, nie direkt per SQL, MCP oder Dashboard. **Bestehende Migrationen nie ändern.** Umbenennen oder Löschen nur nach Absprache.
- **Ablauf bei DB-Änderungen:**
  1. `pnpm db:check` (und `pnpm db:test`)
  2. `pnpm supabase db push --remote --yes` (nur Dev-Projekt)
  3. `pnpm db:types`
  4. Commit auf Branch `db/<kurzname>`, PR
- **Live-Projekt nur mit Bens ausdrücklichem OK.**
- **Geschäftsregeln nur serverseitig** in Postgres-RPCs. Clients rufen RPCs auf und prüfen Eingaben mit den Zod-Schemas aus `@repo/shared`.
- **`@repo/shared` nutzen, nicht nachbauen:** `parseRpcError`, `toRpcArgs`, Zod-Schemas, `formatPrice`, `formatDateTime`/`offerTimeLabel` (Europe/Berlin), Kategorien- und Status-Labels, Design-Tokens, `Database`-Typen.
- **Geld** in ganzen Cent (`*_cents`). **Zeit** als `timestamptz`, Anzeige immer in Europe/Berlin. **Oberfläche** auf Deutsch.
- **Fehler** aus RPCs über den Code in `error.message` behandeln (z. B. `AUSGEBUCHT`), nie über freie Texte.
- **Secrets** nur in `.env`-Dateien, nie committen, nie in Chats oder Cloud-Tasks kopieren. Das Repo ist öffentlich. Der Secret Key gehört nie in App-Code oder `NEXT_PUBLIC_`-/`EXPO_PUBLIC_`-Variablen.
- **Gemeinsame Bereiche** (`packages/`, `tooling/`, Root-Konfiguration, `docs/`, `.github/`) nur in eigenen, kleinen PRs ändern, nie nebenbei in einem Feature-PR.
- **Eigene Testdaten** mit Präfix anlegen („TEST Ben …“). Seed-Daten nicht verändern.

## Vor jedem Commit

```bash
pnpm check                      # Format, Lint, Typecheck, Unit-Tests
pnpm db:check && pnpm db:test   # zusätzlich bei Änderungen an supabase/
```

Commit-Messages kurz und auf Deutsch, mit Bereich vorne: `app: …`, `web: …`, `db: …`, `shared: …`, `backend: …`.

## Aktuelle Versionen (nicht aus dem Gedächtnis raten)

Expo SDK 58 (React Native 0.88, React 19.3), Next.js 16, Tailwind CSS v4 (CSS-first, `@theme`), Zod 4, TypeScript 6.0, Supabase CLI 3, pnpm 12. Für Expo in Monorepos sind keine manuellen `watchFolders` und kein `node-linker=hoisted` nötig (siehe `apps/mobile/README.md`). Im Zweifel die aktuelle offizielle Doku prüfen.

## Datenbank ansehen

- **Struktur:** `packages/shared/src/types/database.types.ts` (generiert) und `supabase/migrations/`
- **Ist-Zustand:** Supabase-MCP-Server **nur lesend** (`https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true`), falls der Agent MCP unterstützt
- **Erwartetes Verhalten:** die SQL-Tests in `supabase/tests/`
