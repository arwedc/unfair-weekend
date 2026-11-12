# unfair-weekend

Kurzfristige, vergünstigte Angebote lokaler Unternehmen in Münster, gesichert per Gutscheincode.

| Teil                              | Ordner            | Technik          | Zuständig       |
| --------------------------------- | ----------------- | ---------------- | --------------- |
| App für Nutzer                    | `apps/mobile`     | Expo             | Ben (@Mecrylol) |
| Website für Unternehmen und Admin | `apps/web`        | Next.js          | @arwedc         |
| Gemeinsamer Code                  | `packages/shared` | TypeScript, Zod  | beide           |
| Backend                           | `supabase/`       | Supabase (Cloud) | beide           |

**Weiterlesen:** [CLAUDE.md](CLAUDE.md) (Regeln und Befehle) · [docs/BACKEND.md](docs/BACKEND.md) (Tabellen, RPCs, Fehlercodes, Testzugänge) · [docs/SPEC.md](docs/SPEC.md) (Anforderungen, Annahmen)

---

## Einrichtung auf einem neuen Rechner

Wir arbeiten direkt mit einem gemeinsamen Supabase-Dev-Projekt in der Cloud. **Docker und ein lokales Supabase brauchst du nicht.**

### 0. Zugänge (einmalig, macht Ben)

- **GitHub:** Collaborator im Repo `arwedc/unfair-weekend`
- **Supabase:** Einladung in die Organisation des Dev-Projekts (Dashboard → Organization Settings → Team → Invite). Ohne die Einladung funktionieren `supabase login`/`link` für dein Konto nicht, und du siehst die Keys nicht.
- **Testkonten:** Ben schickt dir `SEED_TEST_PASSWORD` direkt, nicht über GitHub.

### 1. Werkzeuge

- **Node.js 22** (siehe `.nvmrc`), z. B. mit `brew install node@22` oder `nvm install 22`
- **pnpm:** `corepack enable` (nutzt die Version aus `package.json`) oder `npm install -g pnpm`
- **git**

Die Supabase CLI musst du nicht installieren, sie kommt mit `pnpm install` ins Repo (`pnpm supabase …`).

### 2. Klonen und installieren

```bash
git clone https://github.com/arwedc/unfair-weekend.git
cd unfair-weekend
pnpm install
```

### 3. `.env` anlegen

```bash
cp .env.example .env
```

Die Werte findest du im Supabase-Dashboard des Dev-Projekts. In `.env.example` steht bei jeder Variable, wo genau:

| Variable                   | Wo                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_PROJECT_REF`     | Project Settings → General → Project ID                                                                                                                                 |
| `SUPABASE_URL`             | `https://<Project ID>.supabase.co`                                                                                                                                      |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key                                                                                                                           |
| `SUPABASE_SECRET_KEY`      | Project Settings → API Keys → Secret keys (für dich ggf. einen eigenen anlegen)                                                                                         |
| `SUPABASE_DB_PASSWORD`     | von Ben (Datenbank-Passwort des Projekts)                                                                                                                               |
| `SUPABASE_DB_URL`          | oben „Connect“ → **Session pooler** → URI, `[YOUR-PASSWORD]` ersetzen. Sonderzeichen im Passwort URL-kodieren und den ganzen Wert in einfache Anführungszeichen setzen. |
| `SEED_TEST_PASSWORD`       | von Ben                                                                                                                                                                 |

Die `.env` wird nie committet. Für die Website kommt später zusätzlich `apps/web/.env.local` dazu (siehe [apps/web/README.md](apps/web/README.md)).

### 4. Supabase CLI verbinden

```bash
pnpm supabase login                                   # öffnet den Browser
set -a && source .env && set +a                       # Passwort für die CLI bereitstellen
pnpm supabase link --project-ref "$SUPABASE_PROJECT_REF"
pnpm supabase migration list --remote                 # Kontrolle: zeigt die eingespielten Migrationen
```

Wichtig bei der CLI v3: Gegen das Dev-Projekt immer `--remote` angeben, sonst sucht sie ein lokales Supabase.

### 5. Prüfen, ob alles läuft

```bash
pnpm check      # Format, Lint, Typecheck, Unit-Tests
pnpm db:check   # Verbindung zur DB + Probelauf offener Migrationen (Rollback)
pnpm db:test    # alle SQL-Tests gegen das Dev-Projekt (Rollback, keine Spuren)
```

Wenn alles grün ist, bist du startklar.

### 6. Optional: Claude Code

```bash
claude plugin marketplace add supabase/agent-skills
claude plugin install supabase@supabase-agent-skills
claude plugin install postgres-best-practices@supabase-agent-skills
claude mcp add --scope local --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=<Project ID>&read_only=true"
```

Danach in Claude Code `/mcp` → `supabase` → Authenticate. Der MCP-Server ist bewusst **nur lesend**. Schemaänderungen laufen ausschließlich über Migrationsdateien (siehe [CLAUDE.md](CLAUDE.md)).

---

## Täglicher Ablauf (kurz)

```bash
git checkout main && git pull && pnpm install   # mindestens täglich
git checkout -b web/mein-feature                # bzw. app/…, db/…, backend/…
# … arbeiten …
pnpm check
```

- Eigener Ordner (`apps/web` bzw. `apps/mobile`): frei ändern, PR ohne Review mergen.
- Datenbank: Migration → `pnpm db:check` → `db push` → `pnpm db:types` → PR auf `db/…` (Ben merged) → kurze Info an den anderen.
- `packages/`, `tooling/`, Root-Konfiguration: eigener kleiner PR, der andere reviewt.

Details und alle Befehle: [CLAUDE.md](CLAUDE.md).
