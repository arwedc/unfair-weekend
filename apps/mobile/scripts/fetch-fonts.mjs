/**
 * Lädt die Schrift Satoshi (Indian Type Foundry, Fontshare) für Überschriften und Preise.
 *
 * Warum ein Download statt Dateien im Repo: Die ITF Free Font License erlaubt die Nutzung in
 * unserer App, verbietet aber die Weitergabe der Schriftdateien, z. B. über ein öffentliches
 * Repository. Deshalb liegen die Dateien nur lokal bzw. im Build (gitignored) und werden hier
 * unverändert von Fontshare geholt. Läuft automatisch nach `pnpm install` (postinstall).
 *
 * Schreibt immer `src/theme/satoshi.generated.ts`. Klappt der Download nicht (z. B. offline),
 * ist `SATOSHI_AVAILABLE` false und die App nutzt überall Inter weiter.
 */
/* global fetch, Buffer, console -- läuft in Node beim Installieren */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = join(root, 'assets', 'fonts', 'satoshi');
const moduleFile = join(root, 'src', 'theme', 'satoshi.generated.ts');

// Schnitte, die wir brauchen: Name in der App → Stärke bei Fontshare.
const WEIGHTS = { 'Satoshi-Medium': 500, 'Satoshi-Bold': 700, 'Satoshi-Black': 900 };
const CSS_URL = `https://api.fontshare.com/v2/css?f[]=satoshi@${Object.values(WEIGHTS).join(',')}&display=swap`;

function writeModule(available) {
  const header =
    '// Automatisch erzeugt von scripts/fetch-fonts.mjs (postinstall). Nicht von Hand ändern, nicht committen.\n';
  // require() steckt in einer Funktion: Tests (Vitest) laden die Datei, ohne die Schriften zu lesen.
  const entries = Object.keys(WEIGHTS)
    .map((name) => `    '${name}': require('../../assets/fonts/satoshi/${name}.ttf'),`)
    .join('\n');
  const body = available
    ? `export const SATOSHI_AVAILABLE = true;\n\nexport function satoshiFonts() {\n  return {\n${entries}\n  };\n}\n`
    : 'export const SATOSHI_AVAILABLE = false;\n\nexport function satoshiFonts() {\n  return {};\n}\n';
  mkdirSync(dirname(moduleFile), { recursive: true });
  writeFileSync(moduleFile, header + body);
}

async function download() {
  const allThere = Object.keys(WEIGHTS).every((name) => existsSync(join(fontDir, `${name}.ttf`)));
  if (allThere) return true;

  const css = await (await fetch(CSS_URL)).text();
  // Pro @font-face-Block die Stärke und die TTF-Adresse herausziehen.
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((match) => match[1] ?? '');
  mkdirSync(fontDir, { recursive: true });
  for (const [name, weight] of Object.entries(WEIGHTS)) {
    const face = faces.find((block) => new RegExp(`font-weight:\\s*${weight}\\b`).test(block));
    const url = face?.match(/url\('([^']+\.ttf)'\)/)?.[1];
    if (!url) throw new Error(`Keine TTF-Adresse für ${name}`);
    const response = await fetch(url.startsWith('//') ? `https:${url}` : url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    writeFileSync(join(fontDir, `${name}.ttf`), Buffer.from(await response.arrayBuffer()));
  }
  return true;
}

try {
  writeModule(await download());
  console.log('Satoshi bereit (assets/fonts/satoshi).');
} catch (error) {
  writeModule(false);
  console.warn(`Satoshi nicht geladen, die App nutzt Inter: ${error.message}`);
}
