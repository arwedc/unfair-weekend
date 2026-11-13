/**
 * Ende-zu-Ende-Test der Zahlungen (Variante B) gegen das Dev-Projekt und die
 * Stripe-SANDBOX: echte PaymentIntents mit Testkarten, echter Webhook, echter
 * Worker (pg_cron → stripe-worker), danach wird alles wieder gelöscht.
 *
 *   pnpm pay:e2e
 *
 * Das globale Flag payments_enabled wird NICHT eingeschaltet (gemeinsames
 * Dev-Projekt, Variante A muss für alle weiterlaufen). Die Reservierung legt das
 * Skript deshalb direkt an, mit denselben Werten wie start_paid_booking (diese
 * Funktion prüfen die SQL-Tests). Ab dem PaymentIntent läuft alles wie in echt.
 *
 * Voraussetzungen (Root-.env): SUPABASE_DB_URL, STRIPE_SECRET_KEY (sk_test_…).
 * Deployte Functions stripe-webhook und stripe-worker, Webhook-Endpunkte in der
 * Sandbox, Vault-Secrets für den Worker. Dauer: 2–4 Minuten (Worker läuft minütlich).
 * Testdaten heißen „TEST Pay …“.
 */
import type pg from 'pg';
import { createClient, describePgError } from './db';
import { requireEnv } from './env';

const STRIPE_VERSION = '2026-10-28.endive';
const STAMP = Date.now();

type Json = Record<string, unknown>;

const results: { name: string; ok: boolean; note?: string }[] = [];

function record(name: string, ok: boolean, note?: string): void {
  results.push({ name, ok, note });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${note ? ` – ${note}` : ''}`);
}

async function stripeCall(
  method: 'GET' | 'POST',
  path: string,
  form: Record<string, string> = {},
): Promise<Json> {
  const key = requireEnv('STRIPE_SECRET_KEY');
  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? new URLSearchParams(form) : undefined,
  });
  return (await response.json()) as Json;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wartet, bis die Abfrage `true` liefert (Webhook bzw. Worker sind asynchron). */
async function waitFor(
  db: pg.Client,
  sql: string,
  params: unknown[],
  timeoutMs: number,
): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { rows } = await db.query<{ ok: boolean }>(sql, params);
    if (rows[0]?.ok) return true;
    await sleep(2000);
  }
  return false;
}

async function actAs(db: pg.Client, userId: string): Promise<void> {
  await db.query(
    `select set_config('role', 'authenticated', true),
            set_config('request.jwt.claim.sub', $1, true),
            set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
    [userId],
  );
}

/** Als Nutzer bzw. Standort eine Funktion aufrufen (eigene Transaktion, Commit). */
async function asUser<T extends pg.QueryResultRow>(
  db: pg.Client,
  userId: string,
  sql: string,
  params: unknown[],
): Promise<pg.QueryResult<T>> {
  await db.query('begin');
  try {
    await actAs(db, userId);
    const result = await db.query<T>(sql, params);
    await db.query('commit');
    return result;
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

interface Fixtures {
  locationId: string;
  locationUser: string;
  users: Record<'mia' | 'jonas' | 'lea' | 'tom', string>;
  offers: Record<'kurs' | 'knapp' | 'absage', string>;
}

async function setup(db: pg.Client): Promise<Fixtures> {
  await db.query('begin');
  const users = await db.query<{ id: string; name: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
     select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'autotest+pay-' || $1 || '-' || n || '@example.com',
       case when n = 'standort' then '{"account_type":"standort"}'::jsonb
            else jsonb_build_object('first_name', 'TEST Pay ' || n, 'last_name', 'Autotest') end,
       '{"provider":"email","providers":["email"]}'::jsonb, now(), now(), now()
     from unnest(array['mia', 'jonas', 'lea', 'tom', 'standort']) n
     returning id, split_part(split_part(email, '-', 3), '@', 1) as name`,
    [String(STAMP)],
  );
  const byName = Object.fromEntries(users.rows.map((r) => [r.name, r.id]));
  const company = await db.query<{ id: string }>(
    'insert into public.companies (name) values ($1) returning id',
    [`TEST Pay Firma ${STAMP}`],
  );
  // Erst „pending“, damit der Trigger für neue Angebote keine Pushes an Favoriten verschickt
  const location = await db.query<{ id: string }>(
    `insert into public.locations (company_id, account_user_id, name, street, postal_code, city, status)
     values ($1, $2, $3, 'Prinzipalmarkt 1', '48143', 'Münster', 'pending') returning id`,
    [company.rows[0]?.id, byName.standort, `TEST Pay Standort ${STAMP}`],
  );
  const locationId = location.rows[0]!.id;
  const offer = async (title: string, capacity: number): Promise<string> => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.offers (location_id, title, description, category, image_paths, original_price_cents,
         deal_price_cents, capacity, max_per_user, address, lat, lng, type, starts_at, ends_at)
       values ($1, $2, 'Temporäres Angebot für den Zahlungstest.', 'sonstiges', '{}', 4000, 2400, $3, 2,
         'Prinzipalmarkt 1, 48143 Münster', 51.9625, 7.628, 'einzeltermin',
         now() + interval '3 days', now() + interval '3 days 2 hours')
       returning id`,
      [locationId, `TEST Pay ${title} ${STAMP}`, capacity],
    );
    return rows[0]!.id;
  };
  const offers = {
    kurs: await offer('Kurs', 10),
    knapp: await offer('Letzter Platz', 1),
    absage: await offer('Absage', 10),
  };
  await db.query("update public.locations set status = 'approved' where id = $1", [locationId]);
  await db.query('commit');
  return {
    locationId,
    locationUser: byName.standort!,
    users: { mia: byName.mia!, jonas: byName.jonas!, lea: byName.lea!, tom: byName.tom! },
    offers,
  };
}

/** Reservierung wie start_paid_booking (Betrag und Provision aus der DB, Plätze belegt). */
async function reserve(db: pg.Client, userId: string, offerId: string, seats = 1): Promise<string> {
  await db.query('begin');
  const { rows } = await db.query<{ id: string }>(
    `with o as (select * from public.offers where id = $2 for update),
          s as (select * from public.payment_settings where id)
     insert into public.paid_bookings (offer_id, location_id, user_id, seats, unit_price_cents, amount_cents,
       commission_bps, commission_cents, reserved_until)
     select o.id, o.location_id, $1, $3, o.deal_price_cents, o.deal_price_cents * $3,
       s.commission_bps, private.commission_cents(o.deal_price_cents * $3, s.commission_bps),
       now() + make_interval(mins => s.reservation_minutes)
     from o, s
     returning id`,
    [userId, offerId, seats],
  );
  await db.query('update public.offers set seats_taken = seats_taken + $2 where id = $1', [
    offerId,
    seats,
  ]);
  await db.query('commit');
  return rows[0]!.id;
}

/** PaymentIntent wie stripe-create-booking anlegen (optional an die Reservierung hängen). */
async function createIntent(db: pg.Client, bookingId: string, attach = true): Promise<string> {
  const { rows } = await db.query<{ amount_cents: number }>(
    'select amount_cents from public.paid_bookings where id = $1',
    [bookingId],
  );
  const intent = await stripeCall('POST', '/v1/payment_intents', {
    amount: String(rows[0]?.amount_cents),
    currency: 'eur',
    'allowed_payment_method_types[]': 'card',
    transfer_group: bookingId,
    description: `TEST Pay ${STAMP}`,
    'metadata[booking_id]': bookingId,
  });
  if (!intent.id) throw new Error(`PaymentIntent: ${JSON.stringify(intent.error)}`);
  if (attach) await db.query('select public.attach_payment_intent($1, $2)', [bookingId, intent.id]);
  return intent.id as string;
}

/** Wie das PaymentSheet: mit Testkarte bestätigen. */
async function confirm(intentId: string, paymentMethod: string): Promise<Json> {
  return await stripeCall('POST', `/v1/payment_intents/${intentId}/confirm`, {
    payment_method: paymentMethod,
    return_url: 'https://example.com/zurueck',
  });
}

async function bookingState(
  db: pg.Client,
  bookingId: string,
): Promise<{ status: string; voucher_id: string | null }> {
  const { rows } = await db.query<{ status: string; voucher_id: string | null }>(
    'select status::text, voucher_id from public.paid_bookings where id = $1',
    [bookingId],
  );
  return rows[0] ?? { status: 'fehlt', voucher_id: null };
}

const STATUS_IS = 'select status::text = $2 as ok from public.paid_bookings where id = $1';
const WEBHOOK_MS = 45_000;
const WORKER_MS = 180_000;

async function run(db: pg.Client, f: Fixtures): Promise<void> {
  // 1. Erfolgreiche Zahlung (Karte)
  const b1 = await reserve(db, f.users.mia, f.offers.kurs, 2);
  const pi1 = await createIntent(db, b1);
  await confirm(pi1, 'pm_card_visa');
  const paid = await waitFor(db, STATUS_IS, [b1, 'bezahlt'], WEBHOOK_MS);
  const s1 = await bookingState(db, b1);
  record(
    '1 Karte: Webhook setzt bezahlt und gibt einen Code aus',
    paid && s1.voucher_id !== null,
    s1.status,
  );

  // 2. 3D Secure: ohne Bestätigung durch den Nutzer bleibt die Buchung reserviert
  const b2 = await reserve(db, f.users.jonas, f.offers.kurs);
  const pi2 = await createIntent(db, b2);
  const r2 = await confirm(pi2, 'pm_card_threeDSecure2Required');
  await sleep(5000);
  record(
    '2 3D Secure: verlangt Bestätigung, Buchung bleibt reserviert',
    r2.status === 'requires_action' && (await bookingState(db, b2)).status === 'reserviert',
    String(r2.status),
  );

  // 3. Abgelehnte Karte
  const b3 = await reserve(db, f.users.lea, f.offers.kurs);
  const pi3 = await createIntent(db, b3);
  const r3 = await confirm(pi3, 'pm_card_chargeDeclined');
  await sleep(5000);
  const err3 = (r3.error as Json | undefined)?.code;
  record(
    '3 Abgelehnte Karte: Fehler, Buchung bleibt reserviert, kein Code',
    err3 === 'card_declined' && (await bookingState(db, b3)).status === 'reserviert',
    String(err3),
  );

  // 5. Timer läuft ab: Plätze frei, PaymentIntent wird vom Worker abgebrochen
  await db.query(
    "update public.paid_bookings set reserved_until = now() - interval '1 second' where id = $1",
    [b3],
  );
  await db.query('select private.release_expired_reservations()');
  const released = (await bookingState(db, b3)).status === 'abgelaufen';
  const cancelled = await waitFor(
    db,
    "select status::text = 'erledigt' as ok from public.payment_jobs where booking_id = $1 and kind = 'pi_abbrechen'",
    [b3],
    WORKER_MS,
  );
  const pi3State = await stripeCall('GET', `/v1/payment_intents/${pi3}`);
  record(
    '5 Timer abgelaufen: Plätze frei, PaymentIntent abgebrochen',
    released && cancelled && pi3State.status === 'canceled',
    String(pi3State.status),
  );

  // 6a. Zahlung nach Ablauf, Platz noch frei → nachträglich bestätigt
  const b6 = await reserve(db, f.users.tom, f.offers.kurs);
  const pi6 = await createIntent(db, b6, false);
  await db.query(
    "update public.paid_bookings set reserved_until = now() - interval '1 second' where id = $1",
    [b6],
  );
  await db.query('select private.release_expired_reservations()');
  await confirm(pi6, 'pm_card_visa');
  record(
    '6a Zahlung zu spät, Platz frei: bestätigt',
    await waitFor(db, STATUS_IS, [b6, 'bezahlt'], WEBHOOK_MS),
  );

  // 6b. Zahlung nach Ablauf, Platz weg → automatische Vollerstattung
  const b6b = await reserve(db, f.users.mia, f.offers.knapp);
  const pi6b = await createIntent(db, b6b, false);
  await db.query(
    "update public.paid_bookings set reserved_until = now() - interval '1 second' where id = $1",
    [b6b],
  );
  await db.query('select private.release_expired_reservations()');
  const bOther = await reserve(db, f.users.jonas, f.offers.knapp);
  await confirm(await createIntent(db, bOther), 'pm_card_visa');
  await waitFor(db, STATUS_IS, [bOther, 'bezahlt'], WEBHOOK_MS);
  await confirm(pi6b, 'pm_card_visa');
  const refunded6b = await waitFor(db, STATUS_IS, [b6b, 'erstattet'], WORKER_MS);
  const seats6b = await db.query<{ seats_taken: number }>(
    'select seats_taken from public.offers where id = $1',
    [f.offers.knapp],
  );
  record(
    '6b Zahlung zu spät, Platz weg: voll erstattet, nicht überbucht',
    refunded6b && seats6b.rows[0]?.seats_taken === 1,
  );

  // 7. Storno vor der Frist → Erstattung
  await asUser(db, f.users.mia, 'select * from public.cancel_paid_booking($1)', [b1]);
  const refunded1 = await waitFor(db, STATUS_IS, [b1, 'erstattet'], WORKER_MS);
  const refund1 = await db.query<{ amount_cents: number; stripe_refund_id: string | null }>(
    'select amount_cents, stripe_refund_id from public.payment_refunds where booking_id = $1',
    [b1],
  );
  record(
    '7 Storno vor der Frist: 48,00 € erstattet',
    refunded1 && refund1.rows[0]?.amount_cents === 4800,
    refund1.rows[0]?.stripe_refund_id ?? '',
  );

  // 9. Absage durch den Standort → alle bezahlten Buchungen erstattet
  const b9a = await reserve(db, f.users.lea, f.offers.absage);
  const b9b = await reserve(db, f.users.tom, f.offers.absage, 2);
  await confirm(await createIntent(db, b9a), 'pm_card_visa');
  await confirm(await createIntent(db, b9b), 'pm_card_visa');
  await waitFor(
    db,
    "select count(*) = 2 as ok from public.paid_bookings where id = any($1) and status = 'bezahlt'",
    [[b9a, b9b]],
    WEBHOOK_MS,
  );
  await asUser(db, f.locationUser, 'select public.cancel_offer($1, $2)', [
    f.offers.absage,
    'TEST Pay Absage',
  ]);
  const refunded9 = await waitFor(
    db,
    "select count(*) = 2 as ok from public.paid_bookings where id = any($1) and status = 'erstattet'",
    [[b9a, b9b]],
    WORKER_MS,
  );
  record('9 Absage: alle bezahlten Buchungen voll erstattet', refunded9);

  // 12. Rückbuchung (Dispute)
  const b12 = await reserve(db, f.users.lea, f.offers.kurs);
  await confirm(await createIntent(db, b12), 'pm_card_createDispute');
  const disputed = await waitFor(
    db,
    'select exists (select 1 from public.payment_disputes where booking_id = $1) as ok',
    [b12],
    WORKER_MS,
  );
  record('12 Rückbuchung: Dispute erfasst und der Buchung zugeordnet', disputed);
}

async function cleanup(db: pg.Client, f: Fixtures | null): Promise<void> {
  if (!f) return;
  await db.query('begin');
  const offers = Object.values(f.offers);
  const bookings = 'select id from public.paid_bookings where offer_id = any($1)';
  await db.query(`delete from public.payment_jobs where booking_id in (${bookings})`, [offers]);
  await db.query(`delete from public.payment_refunds where booking_id in (${bookings})`, [offers]);
  await db.query(`delete from public.payment_transfers where booking_id in (${bookings})`, [
    offers,
  ]);
  await db.query(`delete from public.payment_disputes where booking_id in (${bookings})`, [offers]);
  await db.query('delete from public.paid_bookings where offer_id = any($1)', [offers]);
  await db.query('delete from public.notification_outbox where offer_id = any($1)', [offers]);
  await db.query('delete from public.events where offer_id = any($1)', [offers]);
  await db.query('delete from public.vouchers where offer_id = any($1)', [offers]);
  await db.query('delete from public.offers where id = any($1)', [offers]);
  const company = await db.query<{ company_id: string }>(
    'select company_id from public.locations where id = $1',
    [f.locationId],
  );
  await db.query('delete from public.locations where id = $1', [f.locationId]);
  await db.query('delete from public.companies where id = $1', [company.rows[0]?.company_id]);
  await db.query('delete from auth.users where email like $1', [`autotest+pay-${STAMP}-%`]);
  await db.query('commit');
  const left = await db.query<{ n: string }>(
    'select count(*) as n from auth.users where email like $1',
    [`autotest+pay-${STAMP}-%`],
  );
  console.log(
    Number(left.rows[0]?.n) === 0
      ? '  ✓ Aufgeräumt: keine TEST-Pay-Daten mehr im Dev-Projekt'
      : '  ✗ Aufräumen unvollständig!',
  );
}

async function main(): Promise<void> {
  if (!requireEnv('STRIPE_SECRET_KEY').startsWith('sk_test_')) {
    throw new Error('pay:e2e läuft nur mit einem Sandbox-Key (sk_test_…).');
  }
  const db = createClient('unfair-pay-e2e');
  await db.connect();
  let fixtures: Fixtures | null = null;
  try {
    console.log('Zahlungen Ende-zu-Ende (Stripe-Sandbox), dauert einige Minuten …');
    fixtures = await setup(db);
    await run(db, fixtures);
  } catch (error) {
    record('Abbruch', false, describePgError(error));
    await db.query('rollback').catch(() => undefined);
  } finally {
    await cleanup(db, fixtures).catch((error) =>
      console.error('  ✗ Aufräumen fehlgeschlagen:', describePgError(error)),
    );
    await db.end();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed === 0
      ? `Alle ${results.length} Szenarien bestanden.`
      : `${failed} von ${results.length} Szenarien fehlgeschlagen.`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
