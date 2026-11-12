import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Wurzel des Repos (tooling/db/src → ../../..). */
export const repoRoot = resolve(import.meta.dirname, '../../..');

let loaded = false;

/** Lädt die Root-`.env` (falls vorhanden) in `process.env`. */
export function loadEnv(): void {
  if (loaded) return;
  const path = resolve(repoRoot, '.env');
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
  loaded = true;
}

/** Liest eine Pflicht-Variable oder bricht mit verständlicher Meldung ab. */
export function requireEnv(name: string): string {
  loadEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} fehlt in der .env (Vorlage: .env.example).`);
  }
  return value;
}
