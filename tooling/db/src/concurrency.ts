/**
 * Nebenläufigkeit von claim_voucher mit echten, parallelen Verbindungen.
 *
 * Sperr-Test (läuft in `pnpm db:test`, nur Rollback, keine Spuren):
 *   Verbindung A holt einen Code und hält die Transaktion offen. Verbindung B
 *   versucht dasselbe Angebot und läuft in den Lock-Timeout. Beweis: claim_voucher
 *   serialisiert über die Zeilensperre auf dem Angebot. Nutzt ein vorhandenes
 *   holbares Angebot (z. B. aus dem Seed), weil Daten aus einer offenen
 *   Transaktion für andere Verbindungen unsichtbar sind.
 *
 * Wettrennen (`pnpm db:test:race`, echte Commits, danach vollständig aufgeräumt):
 *   10 Verbindungen wollen gleichzeitig den letzten freien Platz. Erwartet:
 *   genau 1 Erfolg, 9 × AUSGEBUCHT. Legt dafür ein temporäres Angebot
 *   „TEST AUTOTEST Wettrennen …“ und 10 Testkonten an und löscht sie im finally.
 */
import type pg from 'pg';
import { createClient, describePgError } from './db';

const RACE_USERS = 10;

async function actAs(client: pg.Client, userId: string): Promise<void> {
  await client.query(
    `select set_config('role', 'authenticated', true),
            set_config('request.jwt.claim.sub', $1, true),
            set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
    [userId],
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Sperr-Test. Gibt false zurück, wenn er fehlschlägt; überspringt ohne passende Daten. */
export async function runLockTest(): Promise<boolean> {
  const setup = createClient('unfair-lock-setup');
  await setup.connect();
  const candidate = await setup.query<{
    offer_id: string;
    user_a: string;
    user_b: string;
    seats: number;
  }>(`
    with offer as (
      select f.id, f.free_seats from public.list_offers(null, null, true, 100, 0) f
      where f.free_seats >= 2 order by f.relevant_at limit 1
    ),
    users as (
      select p.id from public.profiles p, offer o
      where p.role = 'nutzer' and p.first_name is not null and p.last_name is not null
        and (p.blocked_until is null or p.blocked_until < now())
        and not exists (select 1 from public.vouchers v where v.offer_id = o.id and v.user_id = p.id and v.status = 'aktiv')
      order by p.created_at limit 2
    )
    select o.id as offer_id,
      (select id from users order by id limit 1) as user_a,
      (select id from users order by id desc limit 1) as user_b,
      (select seats_taken from public.offers where id = o.id) as seats
    from offer o
  `);
  await setup.end();

  const row = candidate.rows[0];
  if (!row || !row.user_a || row.user_a === row.user_b) {
    console.log(
      'Sperr-Test: übersprungen (kein holbares Angebot oder keine zwei Nutzer, z. B. vor dem Seed).',
    );
    return true;
  }

  const a = createClient('unfair-lock-a');
  const b = createClient('unfair-lock-b');
  await Promise.all([a.connect(), b.connect()]);
  let passed = false;
  try {
    await a.query('begin');
    await actAs(a, row.user_a);
    await a.query('select * from public.claim_voucher($1, 1)', [row.offer_id]);

    await b.query('begin');
    await b.query("set local lock_timeout = '1500ms'");
    await actAs(b, row.user_b);
    try {
      await b.query('select * from public.claim_voucher($1, 1)', [row.offer_id]);
      console.error('  ✗ Verbindung B kam trotz offener Sperre von A durch.');
    } catch (error) {
      const code = (error as pg.DatabaseError).code;
      if (code === '55P03') {
        passed = true;
      } else {
        console.error(`  ✗ Unerwarteter Fehler in B: ${describePgError(error)}`);
      }
    }
  } finally {
    await Promise.all([
      a.query('rollback').catch(() => undefined),
      b.query('rollback').catch(() => undefined),
    ]);
    await Promise.all([a.end(), b.end()]);
  }

  // Gegenprobe: ohne Sperre von A klappt B (und wird wieder zurückgerollt)
  const c = createClient('unfair-lock-c');
  await c.connect();
  try {
    await c.query('begin');
    await actAs(c, row.user_b);
    await c.query('select * from public.claim_voucher($1, 1)', [row.offer_id]);
  } catch (error) {
    passed = false;
    console.error(`  ✗ Gegenprobe fehlgeschlagen: ${describePgError(error)}`);
  } finally {
    await c.query('rollback').catch(() => undefined);
  }
  const after = await c.query<{ seats_taken: number }>(
    'select seats_taken from public.offers where id = $1',
    [row.offer_id],
  );
  await c.end();
  if (after.rows[0]?.seats_taken !== row.seats) {
    passed = false;
    console.error('  ✗ seats_taken hat sich verändert, Rollback hat nicht gegriffen.');
  }

  console.log(
    passed
      ? '  ✓ Sperr-Test: zweite Verbindung wartet auf die Zeilensperre (lock_timeout), Gegenprobe ok, nichts gespeichert'
      : '  ✗ Sperr-Test fehlgeschlagen',
  );
  return passed;
}

/** Wettrennen um den letzten Platz mit echten Commits und anschließendem Aufräumen. */
export async function runRaceTest(): Promise<boolean> {
  const stamp = Date.now();
  const emailPattern = `autotest+race-${stamp}-%@example.com`;
  const admin = createClient('unfair-race-admin');
  await admin.connect();
  let offerId: string | undefined;

  try {
    const location = await admin.query<{ id: string }>(
      "select id from public.locations where status = 'approved' order by created_at limit 1",
    );
    const locationId = location.rows[0]?.id;
    if (!locationId) {
      console.log('Wettrennen: übersprungen (kein freigeschalteter Standort, z. B. vor dem Seed).');
      return true;
    }

    await admin.query('begin');
    const offer = await admin.query<{ id: string }>(
      `insert into public.offers (location_id, title, description, category, image_paths, original_price_cents,
         deal_price_cents, capacity, max_per_user, address, lat, lng, type, starts_at, ends_at)
       values ($1, $2, 'Temporäres Angebot für den Nebenläufigkeitstest.', 'sonstiges', array['test/race.jpg'],
         2000, 1000, 1, 1, 'Prinzipalmarkt 1, 48143 Münster', 51.9625, 7.628, 'einzeltermin',
         now() + interval '1 day', now() + interval '1 day 1 hour')
       returning id`,
      [locationId, `TEST AUTOTEST Wettrennen ${stamp}`],
    );
    offerId = offer.rows[0]?.id;
    const users = await admin.query<{ id: string }>(
      `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
       select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         replace($1, '%', i::text), jsonb_build_object('first_name', 'Race' || i, 'last_name', 'Autotest'),
         '{"provider":"email","providers":["email"]}'::jsonb, now(), now(), now()
       from generate_series(1, $2::int) i
       returning id`,
      [emailPattern, RACE_USERS],
    );
    await admin.query('commit');

    // Alle gleichzeitig: verbinden, Transaktion öffnen, dann alle claims parallel abfeuern
    const clients = users.rows.map((_, i) => createClient(`unfair-race-${i}`));
    await Promise.all(clients.map((client) => client.connect()));
    await Promise.all(
      clients.map(async (client, i) => {
        await client.query('begin');
        await actAs(client, users.rows[i]?.id ?? '');
      }),
    );
    const results = await Promise.all(
      clients.map(async (client) => {
        try {
          await client.query('select * from public.claim_voucher($1, 1)', [offerId]);
          await client.query('commit');
          return 'ok';
        } catch (error) {
          await client.query('rollback').catch(() => undefined);
          return errorMessage(error);
        }
      }),
    );
    await Promise.all(clients.map((client) => client.end()));

    const successes = results.filter((r) => r === 'ok').length;
    const soldOut = results.filter((r) => r === 'AUSGEBUCHT').length;
    const state = await admin.query<{ seats_taken: number; vouchers: string }>(
      `select o.seats_taken, (select count(*) from public.vouchers v where v.offer_id = o.id) as vouchers
       from public.offers o where o.id = $1`,
      [offerId],
    );
    const seatsTaken = state.rows[0]?.seats_taken;
    const vouchers = Number(state.rows[0]?.vouchers);

    const passed =
      successes === 1 && soldOut === RACE_USERS - 1 && seatsTaken === 1 && vouchers === 1;
    console.log(
      `${passed ? '  ✓' : '  ✗'} Wettrennen: ${RACE_USERS} parallele Anfragen auf 1 Platz → ` +
        `${successes} Erfolg, ${soldOut} × AUSGEBUCHT, seats_taken = ${seatsTaken}, Codes = ${vouchers}`,
    );
    const other = results.filter((r) => r !== 'ok' && r !== 'AUSGEBUCHT');
    if (other.length > 0) console.error(`    andere Ergebnisse: ${other.join(', ')}`);
    return passed;
  } finally {
    // Aufräumen: alles, was der Test angelegt hat
    await admin.query('rollback').catch(() => undefined);
    await admin.query('begin');
    if (offerId) {
      await admin.query('delete from public.notification_outbox where offer_id = $1', [offerId]);
      await admin.query('delete from public.events where offer_id = $1', [offerId]);
      await admin.query('delete from public.vouchers where offer_id = $1', [offerId]);
      await admin.query('delete from public.offers where id = $1', [offerId]);
    }
    await admin.query('delete from auth.users where email like $1', [emailPattern]);
    await admin.query('commit');
    const left = await admin.query<{ n: string }>(
      `select (select count(*) from auth.users where email like $1)
            + (select count(*) from public.offers where title like 'TEST AUTOTEST Wettrennen%') as n`,
      [emailPattern],
    );
    await admin.end();
    console.log(
      Number(left.rows[0]?.n) === 0
        ? '  ✓ Aufgeräumt: keine Testdaten mehr im Dev-Projekt'
        : '  ✗ Aufräumen unvollständig, bitte prüfen!',
    );
  }
}

/**
 * Sperr-Test für bezahlte Buchungen (Variante B), nur Rollback, keine Spuren.
 *
 * Verbindung A schaltet das Flag NUR in ihrer offenen Transaktion ein (für
 * alle anderen bleibt es aus), gibt dem Standort ein bereites Stripe-Konto und
 * reserviert per start_paid_booking. Verbindung B will auf dasselbe Angebot
 * per claim_voucher und läuft in den Lock-Timeout. Beweis: Reservierung und
 * Code-Vergabe sperren dieselbe Angebotszeile, können sich also nie überholen.
 *
 * Ein echtes Wettrennen mit Commits gibt es hier bewusst nicht: Dafür müsste
 * das globale Flag im gemeinsamen Dev-Projekt eingeschaltet werden.
 */
export async function runPaidLockTest(): Promise<boolean> {
  const setup = createClient('unfair-paylock-setup');
  await setup.connect();
  const candidate = await setup.query<{
    offer_id: string;
    location_id: string;
    user_a: string;
    user_b: string;
    has_account: boolean;
  }>(`
    with offer as (
      select f.id, f.location_id from public.list_offers(null, null, true, 100, 0) f
      where f.free_seats >= 2 and f.deal_price_cents >= 50 order by f.relevant_at limit 1
    ),
    users as (
      select p.id from public.profiles p, offer o
      where p.role = 'nutzer' and p.first_name is not null and p.last_name is not null
        and (p.blocked_until is null or p.blocked_until < now())
        and not exists (select 1 from public.vouchers v where v.offer_id = o.id and v.user_id = p.id and v.status = 'aktiv')
        and not exists (select 1 from public.paid_bookings b where b.offer_id = o.id and b.user_id = p.id and b.status = 'reserviert')
      order by p.created_at limit 2
    )
    select o.id as offer_id, o.location_id,
      (select id from users order by id limit 1) as user_a,
      (select id from users order by id desc limit 1) as user_b,
      exists (select 1 from public.stripe_accounts a where a.location_id = o.location_id) as has_account
    from offer o
  `);
  await setup.end();

  const row = candidate.rows[0];
  if (!row || !row.user_a || row.user_a === row.user_b) {
    console.log(
      'Sperr-Test (Bezahlung): übersprungen (kein buchbares Angebot oder keine zwei Nutzer).',
    );
    return true;
  }

  const a = createClient('unfair-paylock-a');
  const b = createClient('unfair-paylock-b');
  await Promise.all([a.connect(), b.connect()]);
  let passed = false;
  try {
    await a.query('begin');
    await a.query('update public.payment_settings set payments_enabled = true where id');
    if (row.has_account) {
      await a.query(
        'update public.stripe_accounts set transfers_active = true, payouts_enabled = true where location_id = $1',
        [row.location_id],
      );
    } else {
      await a.query(
        `insert into public.stripe_accounts (location_id, stripe_account_id, payouts_enabled, transfers_active)
         values ($1, 'acct_autotestlock', true, true)`,
        [row.location_id],
      );
    }
    await actAs(a, row.user_a);
    await a.query('select * from public.start_paid_booking($1, 1)', [row.offer_id]);

    await b.query('begin');
    await b.query("set local lock_timeout = '1500ms'");
    await actAs(b, row.user_b);
    try {
      await b.query('select * from public.claim_voucher($1, 1)', [row.offer_id]);
      console.error('  ✗ Verbindung B kam trotz offener Reservierung von A durch.');
    } catch (error) {
      const code = (error as pg.DatabaseError).code;
      if (code === '55P03') {
        passed = true;
      } else {
        console.error(`  ✗ Unerwarteter Fehler in B: ${describePgError(error)}`);
      }
    }
  } catch (error) {
    console.error(`  ✗ Reservierung in A fehlgeschlagen: ${describePgError(error)}`);
  } finally {
    await Promise.all([
      a.query('rollback').catch(() => undefined),
      b.query('rollback').catch(() => undefined),
    ]);
    await Promise.all([a.end(), b.end()]);
  }

  // Gegenprobe: Flag ist für alle anderen weiterhin aus, nichts wurde gespeichert
  const c = createClient('unfair-paylock-c');
  await c.connect();
  const after = await c.query<{ enabled: boolean; bookings: string }>(
    `select (select payments_enabled from public.payment_settings) as enabled,
            (select count(*) from public.paid_bookings where offer_id = $1 and user_id = $2) as bookings`,
    [row.offer_id, row.user_a],
  );
  await c.end();
  if (after.rows[0]?.enabled !== false || Number(after.rows[0]?.bookings) !== 0) {
    passed = false;
    console.error('  ✗ Flag oder Buchung ist nach dem Rollback noch da!');
  }

  console.log(
    passed
      ? '  ✓ Sperr-Test (Bezahlung): claim_voucher wartet auf die Reservierung, Flag bleibt aus, nichts gespeichert'
      : '  ✗ Sperr-Test (Bezahlung) fehlgeschlagen',
  );
  return passed;
}

// Direktaufruf: tsx src/concurrency.ts race
if (process.argv[1]?.endsWith('concurrency.ts')) {
  const mode = process.argv[2] ?? 'lock';
  const ok =
    mode === 'race'
      ? await runRaceTest()
      : mode === 'paylock'
        ? await runPaidLockTest()
        : await runLockTest();
  process.exitCode = ok ? 0 : 1;
}
