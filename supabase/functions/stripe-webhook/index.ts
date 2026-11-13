/**
 * Edge Function „stripe-webhook“: alle Stripe-Events. Nur hier wird eine
 * Buchung auf „bezahlt“ gesetzt (nie über die Rückmeldung der App).
 *
 * Zwei Endpunkte in Stripe zeigen auf diese URL:
 *   1. Plattform-Events (Snapshot, Secret STRIPE_WEBHOOK_SECRET):
 *      payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled,
 *      refund.created, refund.updated, refund.failed,
 *      charge.dispute.created, charge.dispute.updated, charge.dispute.closed,
 *      charge.dispute.funds_withdrawn, charge.dispute.funds_reinstated
 *   2. Konto-Events der Standorte (Accounts v2, Thin Events, Secret STRIPE_CONNECT_WEBHOOK_SECRET):
 *      v2.core.account[configuration.recipient].capability_status_updated,
 *      v2.core.account[requirements].updated, v2.core.account.updated
 *
 * Sicherheit: Signatur wird immer geprüft (constructEventAsync bzw.
 * parseEventNotificationAsync mit WebCrypto). verify_jwt = false, weil Stripe
 * kein Supabase-JWT schickt.
 * Idempotenz: Jede Event-ID wird gespeichert (record_webhook_event). Ein schon
 * verarbeitetes Event wird mit 200 quittiert und nicht erneut ausgeführt; die
 * Verarbeitung selbst ist zusätzlich idempotent (confirm_paid_booking usw.).
 * Antwort 500 → Stripe stellt das Event später erneut zu.
 *
 * Deploy: pnpm supabase functions deploy stripe-webhook --use-api --no-verify-jwt
 */
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { retrieveAccount, syncAccount } from '../_shared/accounts.ts';
import { processJobs } from '../_shared/jobs.ts';
import { cryptoProvider, stripe, stripeErrorText, type Stripe } from '../_shared/stripe.ts';

/** Testmodus-Events nur mit Test-Key verarbeiten und umgekehrt. */
function expectedLivemode(): boolean {
  return (Deno.env.get('STRIPE_SECRET_KEY') ?? '').includes('_live_');
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

async function handleSnapshotEvent(admin: SupabaseClient, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      const bookingId = intent.metadata?.booking_id;
      if (!bookingId) return; // keine Buchung von uns
      const { data, error } = await admin
        .rpc('confirm_paid_booking', {
          p_booking_id: bookingId,
          p_payment_intent_id: intent.id,
          p_charge_id: idOf(intent.latest_charge),
          p_amount_received: intent.amount_received,
          p_currency: intent.currency,
        })
        .single<{ outcome: string; status: string }>();
      if (error) throw new Error(`confirm_paid_booking: ${error.message} ${error.details ?? ''}`);
      console.log('Zahlung verbucht', bookingId, data?.outcome);
      if (data?.outcome === 'erstattung') {
        // Zahlung zu spät und Platz weg: sofort erstatten (sonst übernimmt der Worker)
        await processJobs(admin, { bookingId, limit: 5 }).catch((jobError) =>
          console.error('Sofort-Erstattung', String(jobError)),
        );
      }
      return;
    }

    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled':
      // Reservierung bleibt bis zum Ablauf bestehen; die App kann es erneut versuchen.
      console.log(event.type, event.data.object.metadata?.booking_id ?? '-');
      return;

    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed': {
      const refund = event.data.object;
      const { error } = await admin.rpc('update_refund_status', {
        p_stripe_refund_id: refund.id,
        p_stripe_status: refund.status ?? 'pending',
        p_error: refund.failure_reason ?? null,
      });
      if (error) throw new Error(`update_refund_status: ${error.message}`);
      return;
    }

    case 'charge.dispute.created':
    case 'charge.dispute.updated':
    case 'charge.dispute.closed':
    case 'charge.dispute.funds_withdrawn':
    case 'charge.dispute.funds_reinstated': {
      const dispute = event.data.object;
      const closed = ['won', 'lost', 'warning_closed', 'prevented'].includes(dispute.status);
      const dueBy = dispute.evidence_details?.due_by;
      const { error } = await admin.rpc('record_dispute', {
        p_stripe_dispute_id: dispute.id,
        p_charge_id: idOf(dispute.charge),
        p_payment_intent_id: idOf(dispute.payment_intent),
        p_amount_cents: dispute.amount,
        p_reason: dispute.reason,
        p_stripe_status: dispute.status,
        p_evidence_due_by: dueBy ? new Date(dueBy * 1000).toISOString() : null,
        p_closed: closed,
      });
      if (error) throw new Error(`record_dispute: ${error.message}`);
      return;
    }

    default:
      console.log('Event ignoriert', event.type);
  }
}

async function handleThinEvent(
  admin: SupabaseClient,
  notification: { type: string; related_object: { id: string; type: string } | null },
): Promise<void> {
  if (!notification.type.startsWith('v2.core.account')) {
    console.log('Thin Event ignoriert', notification.type);
    return;
  }
  const accountId = notification.related_object?.id;
  if (!accountId) return;
  // Thin Events enthalten keine Daten: aktuellen Stand abrufen und speichern
  const account = await retrieveAccount(accountId);
  await syncAccount(admin, account);
}

export default {
  fetch: withSupabase({ auth: 'none', cors: 'disabled' }, async (req, ctx) => {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const signature = req.headers.get('stripe-signature');
    if (!signature) return new Response('Signatur fehlt', { status: 400 });
    const payload = await req.text();

    // Welcher Endpunkt? Thin Events (v2) haben object = "v2.core.event". Erst danach wird geprüft.
    let isThin = false;
    try {
      isThin = (JSON.parse(payload) as { object?: string }).object === 'v2.core.event';
    } catch {
      return new Response('Ungültiger Inhalt', { status: 400 });
    }
    const secret = Deno.env.get(isThin ? 'STRIPE_CONNECT_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      console.error(
        'stripe-webhook: Secret fehlt',
        isThin ? 'STRIPE_CONNECT_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET',
      );
      return new Response('Nicht eingerichtet', { status: 500 });
    }

    let id: string;
    let type: string;
    let livemode: boolean;
    let created: string;
    let snapshot: Stripe.Event | null = null;
    let thin: { type: string; related_object: { id: string; type: string } | null } | null = null;
    try {
      if (isThin) {
        const notification = await stripe().parseEventNotificationAsync(
          payload,
          signature,
          secret,
          undefined,
          cryptoProvider,
        );
        id = notification.id;
        type = notification.type;
        livemode = notification.livemode;
        created = new Date(notification.created).toISOString();
        thin = {
          type: notification.type,
          related_object:
            (notification as { related_object?: { id: string; type: string } | null })
              .related_object ?? null,
        };
      } else {
        snapshot = await stripe().webhooks.constructEventAsync(
          payload,
          signature,
          secret,
          undefined,
          cryptoProvider,
        );
        id = snapshot.id;
        type = snapshot.type;
        livemode = snapshot.livemode;
        created = new Date(snapshot.created * 1000).toISOString();
      }
    } catch (error) {
      console.warn('stripe-webhook: Signatur ungültig', stripeErrorText(error));
      return new Response('Signatur ungültig', { status: 400 });
    }

    if (livemode !== expectedLivemode()) {
      console.warn('stripe-webhook: falscher Modus, ignoriert', id, livemode);
      return Response.json({ received: true, ignored: 'livemode' });
    }

    // Idempotenz: schon verarbeitet → nur quittieren
    const { data: shouldProcess, error: recordError } = await ctx.supabaseAdmin.rpc(
      'record_webhook_event',
      {
        p_event_id: id,
        p_type: type,
        p_livemode: livemode,
        p_created: created,
      },
    );
    if (recordError) {
      console.error('record_webhook_event', recordError.message);
      return new Response('Fehler', { status: 500 });
    }
    if (shouldProcess === false) {
      return Response.json({ received: true, duplicate: true });
    }

    try {
      if (snapshot) await handleSnapshotEvent(ctx.supabaseAdmin, snapshot);
      if (thin) await handleThinEvent(ctx.supabaseAdmin, thin);
      await ctx.supabaseAdmin.rpc('finish_webhook_event', { p_event_id: id, p_error: null });
      return Response.json({ received: true });
    } catch (error) {
      const message = stripeErrorText(error);
      console.error('stripe-webhook: Verarbeitung fehlgeschlagen', type, id, message);
      await ctx.supabaseAdmin.rpc('finish_webhook_event', {
        p_event_id: id,
        p_error: message.slice(0, 1000),
      });
      return new Response('Verarbeitung fehlgeschlagen', { status: 500 });
    }
  }),
};
