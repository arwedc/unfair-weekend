/**
 * Edge Function „stripe-cancel-booking“: eigene Buchung abbrechen bzw. stornieren.
 *
 * Aufruf (App, angemeldeter Nutzer):
 *   const { data, error } = await supabase.functions.invoke('stripe-cancel-booking', {
 *     body: { booking_id },
 *   });
 *   // data = { booking_id, status, refund_amount_cents, refund_status }
 *
 * - Reservierung (noch nicht bezahlt): Plätze sofort frei, PaymentIntent wird abgebrochen.
 * - Bezahlt: Storno nach den Fristen von cancel_voucher (FRIST_ABGELAUFEN usw.),
 *   die Vollerstattung wird sofort bei Stripe angestoßen. Klappt das nicht,
 *   holt der Worker sie nach (der Job bleibt bestehen).
 *
 * Fehler: { error: { code, message } } mit 409 (RPC-Codes) bzw. 400 UNGUELTIGE_EINGABE.
 * Deploy: pnpm supabase functions deploy stripe-cancel-booking --use-api
 */
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { processJobs } from '../_shared/jobs.ts';
import { fail, isUuid, rpcFail } from '../_shared/stripe.ts';

interface Cancelled {
  id: string;
  status: string;
  refund_amount_cents: number | null;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return fail(405, 'UNGUELTIGE_EINGABE', 'Bitte per POST aufrufen.');
    }
    const body = (await req.json().catch(() => ({}))) as { booking_id?: unknown };
    if (!isUuid(body.booking_id)) {
      return fail(400, 'UNGUELTIGE_EINGABE', 'Bitte eine Buchung angeben.');
    }

    // Prüft Besitz und Fristen (als angemeldeter Nutzer)
    const { data, error } = await ctx.supabase
      .rpc('cancel_paid_booking', { p_booking_id: body.booking_id })
      .single<Cancelled>();
    if (error || !data) return rpcFail(error ?? { message: 'Keine Antwort' });

    // Erstattung bzw. Abbruch sofort ausführen, statt auf den Cron zu warten
    try {
      await processJobs(ctx.supabaseAdmin, { bookingId: data.id, limit: 5 });
    } catch (jobError) {
      console.error('stripe-cancel-booking: Jobs', String(jobError));
    }

    const { data: refund } = await ctx.supabaseAdmin
      .from('payment_refunds')
      .select('status')
      .eq('booking_id', data.id)
      .maybeSingle<{ status: string }>();

    return Response.json({
      booking_id: data.id,
      status: data.status,
      refund_amount_cents: data.refund_amount_cents,
      refund_status: refund?.status ?? null,
    });
  }),
};
