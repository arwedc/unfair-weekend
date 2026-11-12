import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { repoRoot } from './env';

export interface MigrationFile {
  version: string;
  name: string;
  file: string;
  sql: string;
}

export const migrationsDir = resolve(repoRoot, 'supabase/migrations');

/** Alle Migrationsdateien, nach Version sortiert. */
export async function readMigrationFiles(): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDir).catch(() => [] as string[]);
  const files = entries
    .map((file) => ({ file, match: /^(\d+)_(.+)\.sql$/.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .sort((a, b) => a.file.localeCompare(b.file));

  return Promise.all(
    files.map(async ({ file, match }) => ({
      version: match[1] ?? '',
      name: match[2] ?? '',
      file,
      sql: await readFile(resolve(migrationsDir, file), 'utf8'),
    })),
  );
}

/** Versionen, die laut Supabase-Migrationshistorie schon im Projekt sind. */
export async function readAppliedVersions(client: pg.Client): Promise<Set<string>> {
  const exists = await client.query<{ present: boolean }>(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as present",
  );
  if (!exists.rows[0]?.present) return new Set();
  const result = await client.query<{ version: string }>(
    'select version from supabase_migrations.schema_migrations',
  );
  return new Set(result.rows.map((row) => row.version));
}
