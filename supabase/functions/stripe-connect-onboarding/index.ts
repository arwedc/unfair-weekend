/**
 * Edge Function „stripe-connect-onboarding“: Stripe-Konto eines Standorts
 * (Accounts v2, recipient, Express-Dashboard).
 *
 * Aufruf (Website, angemeldeter Standort):
 *   supabase.functions.invoke('stripe-connect-onboarding', { body: {
 *     action: 'onboarding', return_url: 'https://…/auszahlungen?zurueck=1', refresh_url: 'https://…/auszahlungen?neu=1',
 *   } })
 *   → { url }  (Stripe-gehostete Seite, einmal gültig, wenige Minuten)
 *   action 'dashboard' → { url }  Login-Link zum Express-Dashboard (erst nach dem Onboarding)
 *   action 'status'    → { account }  Stand bei Stripe abfragen und in stripe_accounts speichern
 *
 * Fehler: { error: { code, message } } mit 400 UNGUELTIGE_EINGABE, 403 KEIN_STANDORTKONTO,
 *   404 KEIN_STRIPE_KONTO, 502 STRIPE_NICHT_ERREICHBAR.
 * Deploy: pnpm supabase functions deploy stripe-connect-onboarding --use-api
 */
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { createRecipientAccount, retrieveAccount, syncAccount } from '../_shared/accounts.ts';
import { allowedReturnUrl, fail, stripe, stripeErrorText } from '../_shared/stripe.ts';

interface Body {
  action?: unknown;
  return_url?: unknown;
  refresh_url?: unknown;
}

interface Location {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return fail(405, 'UNGUELTIGE_EINGABE', 'Bitte per POST aufrufen.');
    }
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action;
    if (action !== 'onboarding' && action !== 'dashboard' && action !== 'status') {
      return fail(400, 'UNGUELTIGE_EINGABE', 'action: onboarding, dashboard oder status.');
    }

    // Standort des angemeldeten Kontos (RLS: nur der eigene)
    const userId = ctx.userClaims?.id ?? '';
    const { data: location } = await ctx.supabaseAdmin
      .from('locations')
      .select('id, name, status')
      .eq('account_user_id', userId)
      .maybeSingle<Location>();
    if (!location) {
      return fail(403, 'KEIN_STANDORTKONTO', 'Dieses Konto gehört zu keinem Standort.');
    }
    if (location.status === 'rejected') {
      return fail(403, 'STANDORT_NICHT_FREIGESCHALTET', 'Der Standort ist gesperrt.');
    }

    const { data: existing } = await ctx.supabaseAdmin
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('location_id', location.id)
      .maybeSingle<{ stripe_account_id: string }>();
    let accountId = existing?.stripe_account_id ?? null;

    try {
      if (action === 'onboarding') {
        const returnUrl = allowedReturnUrl(body.return_url);
        const refreshUrl = allowedReturnUrl(body.refresh_url);
        if (!returnUrl || !refreshUrl) {
          return fail(
            400,
            'UNGUELTIGE_EINGABE',
            'return_url und refresh_url müssen zur Website gehören.',
          );
        }
        if (!accountId) {
          const account = await createRecipientAccount({
            locationId: location.id,
            displayName: location.name,
            email: ctx.userClaims?.email ?? null,
          });
          const { error } = await ctx.supabaseAdmin.rpc('register_stripe_account', {
            p_location_id: location.id,
            p_stripe_account_id: account.id,
          });
          if (error) throw new Error(`register_stripe_account: ${error.message}`);
          accountId = account.id;
          await syncAccount(ctx.supabaseAdmin, account);
        }
        const link = await stripe().v2.core.accountLinks.create({
          account: accountId,
          use_case: {
            type: 'account_onboarding',
            // Seit 2026-10-28.endive leitet Stripe die Konfiguration (recipient) aus dem Konto ab.
            account_onboarding: {
              return_url: returnUrl,
              refresh_url: refreshUrl,
            },
          },
        });
        return Response.json({ url: link.url, expires_at: link.expires_at });
      }

      if (!accountId) {
        return fail(
          404,
          'KEIN_STRIPE_KONTO',
          'Für diesen Standort sind noch keine Auszahlungen eingerichtet.',
        );
      }

      if (action === 'dashboard') {
        const loginLink = await stripe().accounts.createLoginLink(accountId);
        return Response.json({ url: loginLink.url });
      }

      // status: Stand bei Stripe abfragen (z. B. nach der Rückkehr vom Onboarding)
      const account = await retrieveAccount(accountId);
      const row = await syncAccount(ctx.supabaseAdmin, account);
      return Response.json({ account: row });
    } catch (error) {
      console.error('stripe-connect-onboarding', action, stripeErrorText(error));
      const message =
        error instanceof Error && /onboarding/i.test(error.message)
          ? 'Bitte schließe zuerst die Einrichtung bei Stripe ab.'
          : 'Stripe ist gerade nicht erreichbar. Bitte versuche es erneut.';
      return fail(502, 'STRIPE_NICHT_ERREICHBAR', message);
    }
  }),
};
