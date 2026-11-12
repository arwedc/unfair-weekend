/**
 * Erzeugt die TypeScript-Typen aus dem Dev-Projekt nach packages/shared.
 * Aufruf: pnpm db:types
 *
 * Nutzt `supabase gen types --remote` (verbunden per `supabase link`, Passwort
 * aus SUPABASE_DB_PASSWORD). Kein Docker nötig.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnv, repoRoot, requireEnv } from './env';

const target = resolve(repoRoot, 'packages/shared/src/types/database.types.ts');
const bin = (name: string) => resolve(repoRoot, 'node_modules/.bin', name);

loadEnv();
requireEnv('SUPABASE_DB_PASSWORD');

const result = spawnSync(
  bin('supabase'),
  ['gen', 'types', '--remote', '--lang', 'typescript', '--schema', 'public', '--agent', 'no'],
  { cwd: repoRoot, env: process.env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
);

if (result.status !== 0 || !result.stdout.includes('export type Database')) {
  console.error(result.stderr || 'Typgenerierung fehlgeschlagen.');
  process.exit(1);
}

const header = `// Automatisch erzeugt mit \`pnpm db:types\` aus dem Supabase-Dev-Projekt.
// NICHT von Hand ändern. Nach jeder Schemaänderung neu erzeugen und committen.
`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, header + result.stdout.trimStart());

const format = spawnSync(bin('prettier'), ['--write', '--log-level', 'warn', target], {
  cwd: repoRoot,
  encoding: 'utf8',
});
if (format.status !== 0) {
  console.error(format.stderr);
  process.exit(1);
}

console.log(`Typen geschrieben: ${target.replace(`${repoRoot}/`, '')}`);
