/**
 * Schreibt die Design-Tokens aus @repo/shared als Tailwind-v4-Theme nach src/styles/theme.css.
 * Läuft automatisch vor `dev` und `build`. Die Datei wird committet, damit der Typecheck
 * und Editoren sie ohne Zwischenschritt finden.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tailwindThemeCss } from '@repo/shared/tokens';

const target = fileURLToPath(new URL('../src/styles/theme.css', import.meta.url));
const header = '/* Automatisch erzeugt aus @repo/shared (pnpm theme). Nicht von Hand ändern. */\n';

writeFileSync(target, header + tailwindThemeCss('light'));
console.log('Theme geschrieben:', target);
