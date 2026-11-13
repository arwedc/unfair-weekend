/**
 * Erzeugt die TypeScript-Typen aus dem Dev-Projekt nach packages/shared.
 * Aufruf: pnpm db:types
 *
 * Nutzt `supabase gen types --remote` (verbunden per `supabase link`, Passwort
 * aus SUPABASE_DB_PASSWORD). Kein Docker nötig.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { loadEnv, repoRoot, requireEnv } from './env';

const target = resolve(repoRoot, 'packages/shared/src/types/database.types.ts');
// Die CLIs direkt mit Node starten statt über node_modules/.bin: Unter Windows
// sind das .cmd-Dateien, die spawnSync ohne Shell nicht ausführen kann.
const cli = (entry: string) => resolve(repoRoot, 'node_modules', entry);
const node = (entry: string, args: string[]) =>
  spawnSync(process.execPath, [cli(entry), ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

loadEnv();
requireEnv('SUPABASE_DB_PASSWORD');

const result = node('supabase/dist/supabase.js', [
  'gen',
  'types',
  '--remote',
  '--lang',
  'typescript',
  '--schema',
  'public',
  '--agent',
  'no',
]);

if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  console.error(result.stderr || 'Typgenerierung fehlgeschlagen.');
  process.exit(1);
}

const header = `// Automatisch erzeugt mit \`pnpm db:types\` aus dem Supabase-Dev-Projekt.
// NICHT von Hand ändern. Nach jeder Schemaänderung neu erzeugen und committen.
`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, header + result.stdout.trimStart());

const format = node('prettier/bin/prettier.cjs', ['--write', '--log-level', 'warn', target]);
if (format.status !== 0) {
  console.error(format.stderr);
  process.exit(1);
}

console.log(`Typen geschrieben: ${relative(repoRoot, target)}`);
