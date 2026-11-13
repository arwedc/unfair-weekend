/**
 * Stripe-Connect-Konten der Standorte (Accounts v2, Konfiguration „recipient“).
 *
 * Separate Charges and Transfers: Der Standort nimmt selbst keine Zahlungen an,
 * er bekommt nur Transfers. „Bereit“ heißt deshalb: stripe_transfers und payouts aktiv.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { stripe, type Stripe } from './stripe.ts';

const ACCOUNT_INCLUDE = ['configuration.recipient', 'requirements'] as const;

/** Neues Konto für einen Standort (idempotent pro Standort). */
export async function createRecipientAccount(input: {
  locationId: string;
  displayName: string;
  email: string | null;
}): Promise<Stripe.V2.Core.Account> {
  return await stripe().v2.core.accounts.create(
    {
      display_name: input.displayName.slice(0, 100),
      ...(input.email ? { contact_email: input.email } : {}),
      identity: { country: 'de' },
      dashboard: 'express',
      defaults: {
        currency: 'eur',
        locales: ['de-DE'],
        responsibilities: { fees_collector: 'application', losses_collector: 'application' },
      },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      metadata: { location_id: input.locationId },
      include: [...ACCOUNT_INCLUDE],
    },
    { idempotencyKey: `location:${input.locationId}:account` },
  );
}

export async function retrieveAccount(accountId: string): Promise<Stripe.V2.Core.Account> {
  return await stripe().v2.core.accounts.retrieve(accountId, { include: [...ACCOUNT_INCLUDE] });
}

/** Status aus dem v2-Konto lesen und in stripe_accounts schreiben. */
export async function syncAccount(
  admin: SupabaseClient,
  account: Stripe.V2.Core.Account,
): Promise<Record<string, unknown> | null> {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;
  const transfers = balance?.stripe_transfers;
  const payouts = balance?.payouts;
  const entries = account.requirements?.entries ?? [];
  // Offen sind Anforderungen, auf die Stripe vom Standort wartet
  const due = entries
    .filter((entry) => entry.awaiting_action_from === 'user')
    .map((entry) => entry.description)
    .slice(0, 50);
  const blocked = [transfers, payouts]
    .flatMap((capability) => capability?.status_details ?? [])
    .map((detail) => detail.code)
    .find((code) => code && code !== 'requirements_past_due');

  const { data, error } = await admin.rpc('sync_stripe_account', {
    p_stripe_account_id: account.id,
    p_details_submitted: due.length === 0,
    p_charges_enabled: false,
    p_payouts_enabled: payouts?.status === 'active',
    p_transfers_active: transfers?.status === 'active',
    p_requirements_due: due,
    p_disabled_reason: blocked ?? null,
  });
  if (error) throw new Error(`sync_stripe_account: ${error.message}`);
  return (data as Record<string, unknown> | null) ?? null;
}
