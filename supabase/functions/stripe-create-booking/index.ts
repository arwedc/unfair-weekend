/**
 * Edge Function „stripe-create-booking“: Plätze reservieren und PaymentIntent anlegen.
 *
 * Aufruf (App, angemeldeter Nutzer):
 *   const { data, error } = await supabase.functions.invoke('stripe-create-booking', {
 *     body: { offer_id, seats },
 *   });
 *   // data = { booking_id, client_secret, amount_cents, currency, reserved_until, server_now }
 *   // → PaymentSheet mit client_secret. Ob bezahlt wurde, meldet NUR der Webhook
 *   //   (Status der Zeile in paid_bookings, per Realtime beobachten).
 *
 * Ablauf: start_paid_booking (als Nutzer, Row-Lock, Betrag aus der DB) →
 * PaymentIntent (Idempotency-Key pro Buchung) → attach_payment_intent.
 * Scheitert Stripe, wird die Reservierung sofort wieder freigegeben.
 *
 * Fehler: { error: { code, message } }. 409 mit den RPC-Codes aus RPC_ERROR_MESSAGES
 *   (z. B. AUSGEBUCHT, ZAHLUNGEN_AUS, ANBIETER_NICHT_BEREIT), 400 UNGUELTIGE_EINGABE,
 *   502 STRIPE_NICHT_ERREICHBAR.
 * Deploy: pnpm supabase functions deploy stripe-create-booking --use-api
 */
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import {
  fail,
  isUuid,
  paymentMethodTypes,
  rpcFail,
  stripe,
  stripeErrorText,
} from '../_shared/stripe.ts';

interface Body {
  offer_id?: unknown;
  seats?: unknown;
}

interface StartedBooking {
  id: string;
  offer_id: string;
  seats: number;
  amount_cents: number;
  commission_cents: number;
  currency: string;
  status: string;
  reserved_until: string;
  server_now: string;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return fail(405, 'UNGUELTIGE_EINGABE', 'Bitte per POST aufrufen.');
    }
    const body = (await req.json().catch(() => ({}))) as Body;
    const seats = body.seats;
    if (
      !isUuid(body.offer_id) ||
      typeof seats !== 'number' ||
      !Number.isInteger(seats) ||
      seats < 1 ||
      seats > 20
    ) {
      return fail(400, 'UNGUELTIGE_EINGABE', 'Bitte Angebot und 1–20 Plätze angeben.');
    }

    // 1. Reservieren: läuft als angemeldeter Nutzer (auth.uid() in der Funktion)
    const { data, error } = await ctx.supabase
      .rpc('start_paid_booking', { p_offer_id: body.offer_id, p_seats: seats })
      .single<StartedBooking>();
    if (error || !data) return rpcFail(error ?? { message: 'Keine Antwort' });
    const booking = data;

    // 2. PaymentIntent: Betrag kommt aus der Datenbank, nie vom Client
    let intent;
    try {
      intent = await stripe().paymentIntents.create(
        {
          amount: booking.amount_cents,
          currency: booking.currency,
          allowed_payment_method_types: paymentMethodTypes(),
          transfer_group: booking.id,
          description: `unfair weekend Buchung ${booking.id.slice(0, 8)}`,
          ...(ctx.userClaims?.email ? { receipt_email: ctx.userClaims.email } : {}),
          metadata: {
            booking_id: booking.id,
            offer_id: booking.offer_id,
            user_id: ctx.userClaims?.id ?? '',
            seats: String(booking.seats),
          },
        },
        { idempotencyKey: `booking:${booking.id}:pi` },
      );
    } catch (stripeError) {
      console.error('stripe-create-booking: PaymentIntent', stripeErrorText(stripeError));
      // Reservierung gleich wieder freigeben, damit die Plätze nicht 10 Minuten blockiert sind
      await ctx.supabase.rpc('cancel_paid_booking', { p_booking_id: booking.id });
      return fail(
        502,
        'STRIPE_NICHT_ERREICHBAR',
        'Die Zahlung kann gerade nicht gestartet werden. Bitte versuche es erneut.',
      );
    }

    // 3. PaymentIntent an die Reservierung hängen
    const { error: attachError } = await ctx.supabaseAdmin.rpc('attach_payment_intent', {
      p_booking_id: booking.id,
      p_payment_intent_id: intent.id,
    });
    if (attachError) {
      await stripe()
        .paymentIntents.cancel(intent.id, {}, { idempotencyKey: `booking:${booking.id}:pi-cancel` })
        .catch((cancelError) =>
          console.error('PaymentIntent abbrechen', stripeErrorText(cancelError)),
        );
      return rpcFail(attachError);
    }

    return Response.json({
      booking_id: booking.id,
      client_secret: intent.client_secret,
      amount_cents: booking.amount_cents,
      currency: booking.currency,
      reserved_until: booking.reserved_until,
      server_now: booking.server_now,
    });
  }),
};
