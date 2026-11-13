/**
 * Legt die zwei Vault-Secrets für den Push-Versand an oder aktualisiert sie:
 *   project_url      = SUPABASE_URL
 *   push_worker_key  = SUPABASE_SECRET_KEY (geht als apikey-Header an die Edge Function send-push)
 *
 * Einmal pro Projekt nötig (Dev und später Live). Idempotent: mehrfach ausführen schadet nicht.
 * Gibt keine Werte aus, nur ob angelegt oder aktualisiert.
 *
 *   pnpm db:push-secrets
 */
import { createClient, describePgError } from './db';
import { requireEnv } from './env';

const SECRETS = [
  { name: 'project_url', env: 'SUPABASE_URL', description: 'Projekt-URL für pg_net (send-push)' },
  {
    name: 'push_worker_key',
    env: 'SUPABASE_SECRET_KEY',
    description: 'Secret Key für den Aufruf der Edge Function send-push',
  },
] as const;

async function main(): Promise<void> {
  const values = SECRETS.map((secret) => ({ ...secret, value: requireEnv(secret.env).trim() }));

  const url = values.find((secret) => secret.name === 'project_url')?.value ?? '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    throw new Error(
      'SUPABASE_URL sieht nicht wie eine Projekt-URL aus (https://<ref>.supabase.co).',
    );
  }
  const key = values.find((secret) => secret.name === 'push_worker_key')?.value ?? '';
  if (!key.startsWith('sb_secret_')) {
    throw new Error('SUPABASE_SECRET_KEY muss ein Secret Key sein (beginnt mit sb_secret_).');
  }

  const client = createClient('unfair-push-secrets');
  await client.connect();
  try {
    for (const secret of values) {
      const { rows } = await client.query<{ id: string }>(
        'select id from vault.secrets where name = $1',
        [secret.name],
      );
      const existing = rows[0];
      if (existing) {
        await client.query('select vault.update_secret($1, $2, $3, $4)', [
          existing.id,
          secret.value,
          secret.name,
          secret.description,
        ]);
        console.log(`✔ ${secret.name}: aktualisiert`);
      } else {
        await client.query('select vault.create_secret($1, $2, $3)', [
          secret.value,
          secret.name,
          secret.description,
        ]);
        console.log(`✔ ${secret.name}: angelegt`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`✖ ${describePgError(error)}`);
  process.exitCode = 1;
});
