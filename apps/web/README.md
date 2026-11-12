# apps/web: Website für Unternehmen und Admin (Next.js)

**Zuständig:** @arwedc. Dieser Ordner ist ein Platzhalter. Die Website entsteht in einer eigenen Claude-Code-Session, die hier eine eigene `CLAUDE.md` anlegt.

## Start

```bash
cd apps
pnpm create next-app@latest web   # aktuell: Next.js 16, App Router, Tailwind v4
```

Danach in `apps/web/package.json`:

- `"name": "@repo/web"`
- `"@repo/shared": "workspace:*"` unter `dependencies`
- gemeinsame Versionen (z. B. `zod`, `typescript`) über `"catalog:"` beziehen

`@repo/shared` liefert TypeScript-Quellcode ohne Build-Schritt. Turbopack transpiliert Workspace-Pakete automatisch. Nur falls nötig: `transpilePackages: ['@repo/shared']` in `next.config.ts`.

## Design-Tokens in Tailwind v4

Tailwind v4 wird CSS-first über `@theme` konfiguriert. Die Tokens kommen aus `@repo/shared`:

```ts
// z. B. scripts/generate-theme.ts → schreibt src/styles/theme.css
import { tailwindThemeCss } from '@repo/shared';
// writeFileSync('src/styles/theme.css', tailwindThemeCss());
```

```css
/* globals.css */
@import 'tailwindcss';
@import './theme.css';
```

Daraus entstehen Klassen wie `bg-accent-solid`, `text-text-secondary`, `rounded-card`, `shadow-card` und `text-title1`.

## Anbindung

- `.env.local` in diesem Ordner: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Den Secret Key nur serverseitig und nie mit `NEXT_PUBLIC_`.
- Backend-Vertrag (Tabellen, RPCs, Fehlercodes, Testzugänge): [docs/BACKEND.md](../../docs/BACKEND.md)
- Fehler aus RPCs: `parseRpcError(error)` aus `@repo/shared`, Eingaben mit den Zod-Schemas und `toRpcArgs()` prüfen
- ESLint: eigene `eslint.config.js` (Next.js), kann die Root-Konfiguration importieren und erweitern.
