/**
 * Arbeitsliste des Stripe-Workers (Tabelle payment_jobs) abarbeiten.
 * Genutzt von stripe-worker (Cron) und für sofortige Erstattungen von
 * stripe-cancel-booking und stripe-webhook.
 *
 * Jeder Stripe-Aufruf trägt einen festen Idempotency-Key pro Buchung. Wird ein
 * Job wiederholt (Absturz, Timeout), führt Stripe ihn nicht doppelt aus.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isPermanentStripeError, stripe, stripeErrorText } from './stripe.ts';

interface PaymentJob {
  job_id: number;
  kind: 'pi_abbrechen' | 'erstatten' | 'auszahlen' | 'auszahlung_zurueckholen';
  attempts: number;
  booking_id: string;
  payment_intent_id: string | null;
  charge_id: string | null;
  refund_amount_cents: number | null;
  payout_cents: number | null;
  destination_account_id: string | null;
  stripe_transfer_id: string | null;
}

interface JobResult {
  ok: boolean;
  stripeId?: string;
  stripeStatus?: string;
  error?: string;
  permanent?: boolean;
}

async function runJob(job: PaymentJob): Promise<JobResult> {
  const key = `booking:${job.booking_id}`;
  const metadata = { booking_id: job.booking_id };

  switch (job.kind) {
    case 'pi_abbrechen': {
      if (!job.payment_intent_id) return { ok: true };
      try {
        await stripe().paymentIntents.cancel(
          job.payment_intent_id,
          {},
          { idempotencyKey: `${key}:pi-cancel` },
        );
      } catch (error) {
        // Schon bezahlt oder schon abgebrochen: nichts zu tun (Zahlung verbucht der Webhook)
        const code = (error as { code?: string }).code;
        if (code !== 'payment_intent_unexpected_state') throw error;
      }
      return { ok: true };
    }

    case 'erstatten': {
      if (!job.payment_intent_id || !job.refund_amount_cents) {
        return {
          ok: false,
          permanent: true,
          error: 'Keine Zahlung oder kein Betrag zur Erstattung',
        };
      }
      const refund = await stripe().refunds.create(
        {
          payment_intent: job.payment_intent_id,
          amount: job.refund_amount_cents,
          reason: 'requested_by_customer',
          metadata,
        },
        { idempotencyKey: `${key}:refund` },
      );
      return { ok: true, stripeId: refund.id, stripeStatus: refund.status ?? undefined };
    }

    case 'auszahlen': {
      if (!job.charge_id || !job.destination_account_id || !job.payout_cents) {
        return { ok: false, error: 'Charge, Stripe-Konto oder Betrag fehlt' };
      }
      const transfer = await stripe().transfers.create(
        {
          amount: job.payout_cents,
          currency: 'eur',
          destination: job.destination_account_id,
          // Immer an die Zahlung gebunden: Stripe führt den Transfer aus, sobald das Geld verfügbar ist.
          source_transaction: job.charge_id,
          transfer_group: job.booking_id,
          metadata,
        },
        { idempotencyKey: `${key}:transfer` },
      );
      return { ok: true, stripeId: transfer.id };
    }

    case 'auszahlung_zurueckholen': {
      if (!job.stripe_transfer_id) {
        return { ok: false, permanent: true, error: 'Kein Transfer zum Zurückholen' };
      }
      const reversal = await stripe().transfers.createReversal(
        job.stripe_transfer_id,
        { metadata },
        { idempotencyKey: `${key}:reversal` },
      );
      return { ok: true, stripeId: reversal.id };
    }
  }
}

/** Holt fällige Jobs (optional nur einer Buchung), führt sie aus und meldet das Ergebnis. */
export async function processJobs(
  admin: SupabaseClient,
  options: { limit?: number; bookingId?: string } = {},
): Promise<{ done: number; retry: number; failed: number }> {
  const totals = { done: 0, retry: 0, failed: 0 };
  const { data, error } = await admin.rpc('claim_payment_jobs', {
    p_limit: options.limit ?? 20,
    p_booking_id: options.bookingId ?? null,
  });
  if (error) throw new Error(`claim_payment_jobs: ${error.message}`);

  for (const job of (data ?? []) as PaymentJob[]) {
    let result: JobResult;
    try {
      result = await runJob(job);
    } catch (stripeError) {
      result = {
        ok: false,
        error: stripeErrorText(stripeError),
        permanent: isPermanentStripeError(stripeError),
      };
    }

    const { error: finishError } = await admin.rpc('finish_payment_job', {
      p_job_id: job.job_id,
      p_ok: result.ok,
      p_stripe_id: result.stripeId ?? null,
      p_stripe_status: result.stripeStatus ?? null,
      p_error: result.error ?? null,
      p_permanent: result.permanent ?? false,
    });
    if (finishError) {
      // Der Job bleibt auf „laeuft“ und wird nach 10 Minuten erneut abgeholt (idempotent).
      console.error('finish_payment_job', job.job_id, finishError.message);
    }

    if (result.ok) totals.done += 1;
    else if (result.permanent || job.attempts >= 5) totals.failed += 1;
    else totals.retry += 1;
    if (!result.ok)
      console.warn('Stripe-Job fehlgeschlagen', job.kind, job.booking_id, result.error);
  }
  return totals;
}
