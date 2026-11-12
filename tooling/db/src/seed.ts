/**
 * Seed für das Dev-Projekt: pnpm db:seed
 *
 * 1. Testkonten über die Auth-Admin-API anlegen (bestätigt, Passwort aus
 *    SEED_TEST_PASSWORD). Bereits vorhandene Konten werden übersprungen.
 * 2. supabase/seed.sql in einer Transaktion ausführen (idempotent).
 *
 * Einmalig einspielen, danach nicht mehr verändern (Regel in CLAUDE.md).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from './db';
import { repoRoot, requireEnv } from './env';

interface SeedAccount {
  email: string;
  label: string;
  meta: Record<string, string>;
}

/** Alle Testkonten. Rollen: Admin (per SQL), Nutzer, Standort (account_type). */
export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    email: 'seed-admin@example.com',
    label: 'Admin',
    meta: { first_name: 'Ada', last_name: 'Admin' },
  },
  {
    email: 'seed-mia@example.com',
    label: 'Nutzerin Mia (aktive, eingelöste, stornierte Codes)',
    meta: { first_name: 'Mia', last_name: 'Becker' },
  },
  {
    email: 'seed-jonas@example.com',
    label: 'Nutzer Jonas (1 No-Show)',
    meta: { first_name: 'Jonas', last_name: 'Wagner' },
  },
  {
    email: 'seed-lea@example.com',
    label: 'Nutzerin Lea (abgelaufener Code, Absage)',
    meta: { first_name: 'Lea', last_name: 'Hoffmann' },
  },
  {
    email: 'seed-kochwerk-altstadt@example.com',
    label: 'Standort Kochwerk Altstadt',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-kochwerk-hafen@example.com',
    label: 'Standort Kochwerk am Hafen',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-yoga-kreuzviertel@example.com',
    label: 'Standort Yoga & Move Kreuzviertel',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-yoga-suedviertel@example.com',
    label: 'Standort Yoga & Move Südviertel',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-farbraum@example.com',
    label: 'Standort Atelier Farbraum',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-kulturkeller@example.com',
    label: 'Standort Kulturkeller',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-glow@example.com',
    label: 'Standort Glow Beauty Lounge',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-radlager@example.com',
    label: 'Standort Radlager Werkstatt',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-morgenrot@example.com',
    label: 'Standort Bäckerei Morgenrot (pending)',
    meta: { account_type: 'standort' },
  },
  {
    email: 'seed-partybus@example.com',
    label: 'Standort Partybus (rejected)',
    meta: { account_type: 'standort' },
  },
];

async function createAuthUser(account: SeedAccount): Promise<'neu' | 'vorhanden'> {
  const url = `${requireEnv('SUPABASE_URL').replace(/\/+$/, '')}/auth/v1/admin/users`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: requireEnv('SUPABASE_SECRET_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: account.email,
      password: requireEnv('SEED_TEST_PASSWORD'),
      email_confirm: true,
      user_metadata: account.meta,
    }),
  });
  if (response.ok) return 'neu';
  const body = (await response.json().catch(() => ({}))) as {
    error_code?: string;
    code?: string;
    msg?: string;
  };
  if (
    response.status === 422 &&
    (body.error_code === 'email_exists' || body.code === 'email_exists')
  ) {
    return 'vorhanden';
  }
  throw new Error(`Konto ${account.email}: HTTP ${response.status} ${JSON.stringify(body)}`);
}

async function main(): Promise<void> {
  console.log('Seed: Testkonten anlegen …');
  for (const account of SEED_ACCOUNTS) {
    const result = await createAuthUser(account);
    console.log(`  ${result === 'neu' ? '+' : '='} ${account.email}`);
  }

  console.log('Seed: Daten einspielen (supabase/seed.sql) …');
  const sql = readFileSync(resolve(repoRoot, 'supabase/seed.sql'), 'utf8');
  const client = createClient('unfair-seed');
  await client.connect();
  client.on('notice', (notice) => console.log(`  ${notice.message}`));
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }

  const counts = await client.query<Record<string, string>>(`
    select
      (select count(*) from public.companies where id::text like '5eed%') as unternehmen,
      (select count(*) from public.locations where id::text like '5eed%') as standorte,
      (select count(*) from public.offers where id::text like '5eed%') as angebote,
      (select count(*) from public.vouchers v join public.offers o on o.id = v.offer_id where o.id::text like '5eed%') as codes,
      (select count(*) from public.list_offers(null, null, false, 100, 0)) as im_feed
  `);
  await client.end();
  console.log('Seed: Stand im Dev-Projekt', counts.rows[0]);
}

await main();
