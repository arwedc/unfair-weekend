## Was ändert sich?

<!-- 1–3 Sätze: was und warum -->

## Bereich

- [ ] `apps/mobile` (eigener Bereich)
- [ ] `apps/web` (eigener Bereich)
- [ ] **Gemeinsam**: `supabase/`, `packages/`, `tooling/` oder Root-Konfiguration → eigener, kleiner PR, der andere reviewt

## Checkliste

- [ ] `pnpm typecheck` läuft ohne Fehler
- [ ] `pnpm lint` läuft ohne Fehler
- [ ] `pnpm test` ist grün (bei DB-Änderungen zusätzlich `pnpm db:test`)
- [ ] Keine gemeinsamen Änderungen nebenbei in einem Feature-PR versteckt
- [ ] Keine Secrets, `.env`-Inhalte oder Keys im Diff

### Nur bei Datenbank-Änderungen

- [ ] Neue Migrationsdatei in `supabase/migrations/`, **keine bestehende Migration geändert**
- [ ] Nur hinzugefügt (neue Tabellen/Spalten/Funktionen). Umbenennen/Löschen/Ändern ist abgesprochen mit: …
- [ ] RLS für neue Tabellen aktiviert, Policies für alle Rollen geprüft
- [ ] `pnpm db:check` (Probelauf mit Rollback) erfolgreich
- [ ] Nach dem Merge: `supabase db push` (mit ausdrücklicher Bestätigung) und Typen neu generiert (`pnpm db:types`) und committet

### Doku

- [ ] `docs/BACKEND.md` bzw. `CLAUDE.md` aktualisiert, falls sich Tabellen, RPCs, Fehlercodes oder Abläufe ändern
- [ ] Neue Fehlercodes stehen in `packages/shared` und haben einen deutschen Text
