# unfair-weekend

Kurzfristige, vergünstigte Angebote lokaler Unternehmen in Münster, gesichert per Gutscheincode.

| Teil                              | Ordner            | Technik                     | Zuständig       |
| --------------------------------- | ----------------- | --------------------------- | --------------- |
| App für Nutzer                    | `apps/mobile`     | Expo                        | Ben (@Mecrylol) |
| Website für Unternehmen und Admin | `apps/web`        | Next.js                     | @arwedc         |
| Gemeinsamer Code                  | `packages/shared` | TypeScript, Zod             | beide           |
| Backend                           | `supabase/`       | Supabase (Cloud, Frankfurt) | beide           |

## Schnellstart

Voraussetzungen: Node.js 22 (siehe `.nvmrc`), pnpm. **Kein Docker** nötig.

```bash
git clone https://github.com/arwedc/unfair-weekend.git
cd unfair-weekend
pnpm install
cp .env.example .env    # Werte aus dem Supabase-Dashboard eintragen
pnpm check              # Format, Lint, Typecheck, Tests
```

Die ausführliche Einrichtung (Supabase CLI, `supabase login`, `supabase link`, Keys) folgt mit der Backend-Übergabe.

## Weiterlesen

- [CLAUDE.md](CLAUDE.md): Konventionen, Befehle, Regeln zur Zusammenarbeit
- [docs/SPEC.md](docs/SPEC.md): Anforderungen, Entscheidungen, Annahmen
- [docs/design-referenz/](docs/design-referenz/): Inspiration für das Design
