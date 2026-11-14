/**
 * Lädt die Schrift Satoshi (Indian Type Foundry, Fontshare) für Überschriften und Preise.
 *
 * Warum ein Download statt Dateien im Repo: Die ITF Free Font License erlaubt die Nutzung in
 * unserer App, verbietet aber die Weitergabe der Schriftdateien, z. B. über ein öffentliches
 * Repository. Deshalb liegen die Dateien nur lokal bzw. im Build (gitignored) und werden hier
 * unverändert aus dem offiziellen Fontshare-Paket geholt. Läuft automatisch nach `pnpm install`.
 *
 * Wichtig: Wir nehmen die OTF-Dateien aus dem Komplettpaket, nicht die Web-Schriften der
 * Fontshare-CSS. Die Web-Schriften haben keine echten internen Namen (alle heißen „false“),
 * das iPhone kann dann nur einen der drei Schnitte laden und die Überschriften werden zu dünn.
 * Deshalb prüft das Skript nach dem Entpacken den internen Namen jeder Datei.
 *
 * Schreibt immer `src/theme/satoshi.generated.ts`. Klappt etwas nicht (z. B. offline), ist
 * `SATOSHI_AVAILABLE` false und die App nutzt überall Inter weiter.
 */
/* global fetch, Buffer, console -- läuft in Node beim Installieren */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = join(root, 'assets', 'fonts', 'satoshi');
const moduleFile = join(root, 'src', 'theme', 'satoshi.generated.ts');

/** Schnitte, die wir brauchen. Name in der App = interner PostScript-Name der Datei. */
const FACES = ['Satoshi-Medium', 'Satoshi-Bold', 'Satoshi-Black'];
const PACKAGE_URL = 'https://api.fontshare.com/v2/fonts/download/satoshi';

function writeModule(available) {
  const header =
    '// Automatisch erzeugt von scripts/fetch-fonts.mjs (postinstall). Nicht von Hand ändern, nicht committen.\n';
  // require() steckt in einer Funktion: Tests (Vitest) laden die Datei, ohne die Schriften zu lesen.
  const entries = FACES.map(
    (name) => `    '${name}': require('../../assets/fonts/satoshi/${name}.otf'),`,
  ).join('\n');
  const body = available
    ? `export const SATOSHI_AVAILABLE = true;\n\nexport function satoshiFonts() {\n  return {\n${entries}\n  };\n}\n`
    : 'export const SATOSHI_AVAILABLE = false;\n\nexport function satoshiFonts() {\n  return {};\n}\n';
  mkdirSync(dirname(moduleFile), { recursive: true });
  writeFileSync(moduleFile, header + body);
}

/** Liest einzelne Dateien aus einem Zip (nur „gespeichert“ und „deflate“, mehr braucht es nicht). */
function readZipEntries(zip, wanted) {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('Paket ist kein gültiges Zip');
  const count = zip.readUInt16LE(end + 10);
  let pos = zip.readUInt32LE(end + 16);
  const found = new Map();
  for (let i = 0; i < count; i += 1) {
    const method = zip.readUInt16LE(pos + 10);
    const compressedSize = zip.readUInt32LE(pos + 20);
    const nameLength = zip.readUInt16LE(pos + 28);
    const extraLength = zip.readUInt16LE(pos + 30);
    const commentLength = zip.readUInt16LE(pos + 32);
    const localHeader = zip.readUInt32LE(pos + 42);
    const name = zip.toString('utf8', pos + 46, pos + 46 + nameLength);
    const face = wanted.find((candidate) => name.endsWith(`/OTF/${candidate}.otf`));
    if (face) {
      const dataStart =
        localHeader + 30 + zip.readUInt16LE(localHeader + 26) + zip.readUInt16LE(localHeader + 28);
      const data = zip.subarray(dataStart, dataStart + compressedSize);
      found.set(face, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    }
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return found;
}

/** Interner PostScript-Name (name-Tabelle, ID 6). Danach registriert iOS die Schrift. */
function postScriptName(font) {
  const tables = font.readUInt16BE(4);
  for (let i = 0; i < tables; i += 1) {
    const record = 12 + i * 16;
    if (font.toString('ascii', record, record + 4) !== 'name') continue;
    const offset = font.readUInt32BE(record + 8);
    const count = font.readUInt16BE(offset + 2);
    const strings = offset + font.readUInt16BE(offset + 4);
    for (let j = 0; j < count; j += 1) {
      const entry = offset + 6 + j * 12;
      if (font.readUInt16BE(entry) !== 3 || font.readUInt16BE(entry + 6) !== 6) continue;
      const length = font.readUInt16BE(entry + 8);
      const start = strings + font.readUInt16BE(entry + 10);
      let name = '';
      for (let k = 0; k < length; k += 2) name += String.fromCharCode(font.readUInt16BE(start + k));
      return name;
    }
  }
  return null;
}

function isValid(name) {
  const file = join(fontDir, `${name}.otf`);
  return existsSync(file) && postScriptName(readFileSync(file)) === name;
}

async function download() {
  if (FACES.every(isValid)) return true;

  // Alte Web-Schriften (.ttf mit kaputten Namen) aus früheren Versionen entfernen.
  rmSync(fontDir, { recursive: true, force: true });
  mkdirSync(fontDir, { recursive: true });

  const response = await fetch(PACKAGE_URL);
  if (!response.ok) throw new Error(`Paket: HTTP ${response.status}`);
  const files = readZipEntries(Buffer.from(await response.arrayBuffer()), FACES);
  for (const name of FACES) {
    const font = files.get(name);
    if (!font) throw new Error(`${name}.otf fehlt im Paket`);
    const internal = postScriptName(font);
    if (internal !== name) throw new Error(`${name}: interner Name ist „${internal}“`);
    writeFileSync(join(fontDir, `${name}.otf`), font);
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
