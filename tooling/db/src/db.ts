import pg from 'pg';
import { requireEnv } from './env';

/**
 * Verbindung zum Dev-Projekt über den Session-Pooler (`SUPABASE_DB_URL`).
 *
 * TLS ist aktiv. Das Zertifikat des Poolers ist von Supabase selbst signiert
 * und nicht im System-Zertifikatsspeicher, deshalb wird es hier nicht gegen
 * eine CA geprüft. Für ein Entwickler-Werkzeug gegen das Dev-Projekt ist das
 * vertretbar.
 */
export function createClient(applicationName = 'unfair-db-tools'): pg.Client {
  return new pg.Client({
    connectionString: requireEnv('SUPABASE_DB_URL'),
    ssl: { rejectUnauthorized: false },
    application_name: applicationName,
  });
}

/** Zeile und Spalte zu einer Zeichenposition (für Fehlermeldungen). */
export function lineAndColumn(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, position - 1));
  const lines = before.split('\n');
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

/** Formatiert einen Postgres-Fehler mit Code, Detail und Fundstelle. */
export function describePgError(error: unknown, sql?: string): string {
  if (!(error instanceof Error)) return String(error);
  const e = error as pg.DatabaseError;
  const parts = [e.message];
  if (e.code) parts.push(`SQLSTATE ${e.code}`);
  if (e.detail) parts.push(`Detail: ${e.detail}`);
  if (e.hint) parts.push(`Hinweis: ${e.hint}`);
  if (e.where) parts.push(`Kontext: ${e.where}`);
  if (sql && e.position) {
    const { line, column } = lineAndColumn(sql, Number(e.position));
    const source = sql.split('\n')[line - 1] ?? '';
    parts.push(`Zeile ${line}, Spalte ${column}: ${source.trim()}`);
  }
  return parts.join('\n    ');
}
