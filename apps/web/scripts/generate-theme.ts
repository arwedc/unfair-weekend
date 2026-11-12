/**
 * Schreibt die Design-Tokens aus @repo/shared als Tailwind-v4-Theme nach src/styles/theme.css.
 * Läuft automatisch vor `dev` und `build`. Die Datei wird committet, damit der Typecheck
 * und Editoren sie ohne Zwischenschritt finden.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { tailwindThemeCss } from '@repo/shared/tokens';

const target = fileURLToPath(new URL('../src/styles/theme.css', import.meta.url));
const header = '/* Automatisch erzeugt aus @repo/shared (pnpm theme). Nicht von Hand ändern. */\n';

// Mit Prettier formatieren, damit `pnpm format:check` (CI) nach jedem `pnpm dev` grün bleibt.
const config = await resolveConfig(target);
const css = await format(header + tailwindThemeCss('light'), { ...config, filepath: target });
writeFileSync(target, css);
console.log('Theme geschrieben:', target);
