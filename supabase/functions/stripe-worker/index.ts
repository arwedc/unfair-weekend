/**
 * Edge Function „stripe-worker“: arbeitet die Tabelle payment_jobs ab.
 *   pi_abbrechen             PaymentIntent einer verfallenen Reservierung abbrechen
 *   erstatten                Vollerstattung (Storno, Absage, verspätete Zahlung)
 *   auszahlen                Transfer an den Standort, immer mit source_transaction
 *   auszahlung_zurueckholen  Transfer-Reversal (Absage nach der Auszahlung)
 *
 * Aufruf nur durch pg_cron (private.invoke_payment_worker, jede Minute, nur wenn
 * etwas fällig ist) per pg_net mit dem Secret Key im apikey-Header.
 * verify_jwt = false; die Function prüft den Key selbst (withSupabase auth 'secret').
 * Fehler: Wiederholung mit Backoff (finish_payment_job), ab 5 Versuchen „fehlgeschlagen“
 * und im Admin-Bereich sichtbar.
 *
 * Deploy: pnpm supabase functions deploy stripe-worker --use-api --no-verify-jwt
 */
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { processJobs } from '../_shared/jobs.ts';

/** Mehr Runden pro Aufruf sind nicht nötig, der Cron-Job läuft jede Minute. */
const MAX_ROUNDS = 5;
const BATCH = 20;

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    const totals = { done: 0, retry: 0, failed: 0 };
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const result = await processJobs(ctx.supabaseAdmin, { limit: BATCH });
      totals.done += result.done;
      totals.retry += result.retry;
      totals.failed += result.failed;
      if (result.done + result.retry + result.failed < BATCH) break;
    }
    return Response.json(totals);
  }),
};
