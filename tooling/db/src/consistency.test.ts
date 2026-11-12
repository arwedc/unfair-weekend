/**
 * Prüft ohne Datenbank, dass Migrationen und @repo/shared zusammenpassen.
 * Läuft in `pnpm test` und damit auch in der CI.
 */
import { RPC_ERROR_CODES } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { readMigrationFiles } from './migrations';

describe('Fehlercodes', () => {
  it('jeder Code aus den Migrationen steht in packages/shared und umgekehrt', async () => {
    const sql = (await readMigrationFiles()).map((file) => file.sql).join('\n');
    const fromSql = new Set(
      [...sql.matchAll(/raise_error\(\s*'([A-Z_]+)'/g)].map((match) => match[1]),
    );
    expect([...fromSql].sort()).toEqual([...RPC_ERROR_CODES].sort());
  });
});
