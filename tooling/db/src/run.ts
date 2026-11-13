/**
 * Probelauf und SQL-Tests gegen das gemeinsame Dev-Projekt, ohne Spuren.
 *
 * Ablauf (alles in EINER Transaktion, am Ende immer ROLLBACK):
 *   1. Migrationen einspielen, die laut Migrationshistorie noch fehlen
 *   2. optional: pgTAP + Test-Helfer laden und jede Testdatei in einem
 *      eigenen SAVEPOINT ausführen (danach zurück zum Savepoint)
 *   3. ROLLBACK, im Dev-Projekt bleibt nichts zurück
 *
 * Aufruf:
 *   pnpm db:check                   nur Migrationen (Schritt 1)
 *   pnpm db:test                    Migrationen + alle Tests
 *   pnpm db:test -- claim           nur Testdateien, deren Name „claim“ enthält
 *
 * Danach (ohne Filter) der Sperr-Test für claim_voucher, siehe concurrency.ts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { runLockTest, runPaidLockTest } from './concurrency';
import { createClient, describePgError } from './db';
import { repoRoot } from './env';
import { readAppliedVersions, readMigrationFiles } from './migrations';

const testsDir = resolve(repoRoot, 'supabase/tests');
const helpersFile = resolve(testsDir, '_helpers.sql');

interface Options {
  migrationsOnly: boolean;
  filter: string | undefined;
}

function parseArgs(argv: string[]): Options {
  const args = argv.filter((arg) => arg !== '--');
  return {
    migrationsOnly: args.includes('--migrations-only'),
    filter: args.find((arg) => !arg.startsWith('--')),
  };
}

/** Sammelt die TAP-Zeilen aus allen Ergebnismengen eines Multi-Statement-Aufrufs. */
function collectTapLines(result: pg.QueryResult | pg.QueryResult[]): string[] {
  const results = Array.isArray(result) ? result : [result];
  const lines: string[] = [];
  for (const res of results) {
    for (const row of res.rows as Record<string, unknown>[]) {
      const values = Object.values(row);
      if (values.length !== 1 || typeof values[0] !== 'string') continue;
      for (const line of values[0].split('\n')) {
        if (/^(ok|not ok|#|\s+#|1\.\.)/.test(line)) lines.push(line);
      }
    }
  }
  return lines;
}

async function applyPendingMigrations(client: pg.Client): Promise<number> {
  const [files, applied] = await Promise.all([readMigrationFiles(), readAppliedVersions(client)]);
  const pending = files.filter((file) => !applied.has(file.version));
  if (pending.length === 0) {
    console.log('Migrationen: alle bereits im Dev-Projekt.');
    return 0;
  }
  console.log(`Migrationen: ${pending.length} offen, werden probeweise eingespielt …`);
  for (const migration of pending) {
    try {
      await client.query(migration.sql);
      console.log(`  ✓ ${migration.file}`);
    } catch (error) {
      console.error(`  ✗ ${migration.file}\n    ${describePgError(error, migration.sql)}`);
      throw new Error('Migration fehlgeschlagen.', { cause: error });
    }
  }
  return pending.length;
}

async function runTests(client: pg.Client, filter: string | undefined): Promise<boolean> {
  const files = (await readdir(testsDir).catch(() => [] as string[]))
    .filter((file) => file.endsWith('.test.sql'))
    .filter((file) => !filter || file.includes(filter))
    .sort();
  if (files.length === 0) {
    console.log('Tests: keine Testdateien gefunden.');
    return true;
  }

  await client.query('create extension if not exists pgtap with schema extensions');
  const helpers = await readFile(helpersFile, 'utf8').catch(() => '');
  if (helpers) await client.query(helpers);

  let allPassed = true;
  let total = 0;
  let failed = 0;
  console.log(`Tests: ${files.length} Datei(en)`);

  for (const file of files) {
    const sql = await readFile(resolve(testsDir, file), 'utf8');
    await client.query('savepoint test_file');
    let lines: string[] = [];
    let crashed: string | undefined;
    try {
      lines = collectTapLines(await client.query(sql));
    } catch (error) {
      crashed = describePgError(error, sql);
    }
    await client.query('rollback to savepoint test_file');
    await client.query('reset role');

    const notOk = lines.filter((line) => line.startsWith('not ok'));
    const ok = lines.filter((line) => line.startsWith('ok'));
    const planLine = lines.find((line) => line.startsWith('1..'));
    const planned = planLine ? Number(planLine.slice(3)) : undefined;
    const planMismatch = planned !== undefined && planned !== ok.length + notOk.length;
    total += ok.length + notOk.length;
    failed += notOk.length;

    if (crashed || notOk.length > 0 || planMismatch) {
      allPassed = false;
      console.error(`  ✗ ${file}`);
      for (const line of lines.filter((l) => !l.startsWith('ok') && !l.startsWith('1..'))) {
        console.error(`      ${line}`);
      }
      if (planMismatch)
        console.error(`      geplant ${planned}, ausgeführt ${ok.length + notOk.length}`);
      if (crashed) console.error(`      Abbruch: ${crashed}`);
    } else {
      console.log(`  ✓ ${file} (${ok.length})`);
    }
  }
  console.log(`Tests: ${total - failed}/${total} bestanden.`);
  return allPassed;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const client = createClient('unfair-db-run');
  await client.connect();
  let success: boolean;
  let pending = 0;
  try {
    await client.query('begin');
    // Nicht ewig auf Sperren warten, falls im Dev-Projekt gerade jemand arbeitet.
    await client.query("set local lock_timeout = '10s'");
    await client.query("set local statement_timeout = '120s'");
    pending = await applyPendingMigrations(client);
    success = options.migrationsOnly ? true : await runTests(client, options.filter);
  } catch (error) {
    if (!(error instanceof Error && error.message === 'Migration fehlgeschlagen.')) {
      console.error(describePgError(error));
    }
    success = false;
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.end();
    console.log('Zurückgerollt: Im Dev-Projekt hat sich nichts verändert.');
  }

  // Sperr-Test mit zwei echten Verbindungen. Braucht das Schema im Dev-Projekt,
  // läuft deshalb nur ohne offene Migrationen und ohne Dateifilter.
  if (success && !options.migrationsOnly && !options.filter) {
    if (pending > 0) {
      console.log('Sperr-Test: übersprungen (offene Migrationen sind nur im Probelauf vorhanden).');
    } else {
      success = (await runLockTest()) && (await runPaidLockTest());
    }
  }
  process.exitCode = success ? 0 : 1;
}

await main();
