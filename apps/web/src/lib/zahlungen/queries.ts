import 'server-only';
import type { RpcRow, Tables } from '@repo/shared';
import { createClient } from '@/lib/supabase/server';
import { requireAccount } from '@/lib/auth';
import { requirePaymentAdmin } from './auth';

export type LocationBooking = RpcRow<'get_location_bookings'>;
export type LocationOfferOption = Pick<Tables<'offers'>, 'id' | 'title'>;
export type StripeAccount = Tables<'stripe_accounts'>;
export type PaymentSettings = RpcRow<'get_payment_settings'>;

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_payment_settings');
  if (error) throw new Error('Zahlungseinstellungen konnten nicht geladen werden.');
  return data?.[0] ?? null;
}

export async function getLocationStripeAccount(locationId: string): Promise<StripeAccount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stripe_accounts')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();
  if (error) throw new Error('Der Auszahlungsstatus konnte nicht geladen werden.');
  return data;
}

export async function getLocationPayoutData(): Promise<{
  locationId: string;
  account: StripeAccount | null;
  offers: LocationOfferOption[];
  bookings: LocationBooking[];
}> {
  const { location } = await requireAccount();
  const supabase = await createClient();
  const [accountResult, offerResult, bookingResult] = await Promise.all([
    supabase.from('stripe_accounts').select('*').eq('location_id', location.id).maybeSingle(),
    supabase.from('offers').select('id, title').eq('location_id', location.id).order('created_at', {
      ascending: false,
    }),
    supabase.rpc('get_location_bookings', {
      p_location_id: location.id,
      p_limit: 500,
      p_offset: 0,
    }),
  ]);

  if (accountResult.error || offerResult.error || bookingResult.error) {
    throw new Error('Auszahlungsdaten konnten nicht geladen werden. Bitte versuche es erneut.');
  }

  return {
    locationId: location.id,
    account: accountResult.data,
    offers: offerResult.data ?? [],
    bookings: bookingResult.data ?? [],
  };
}

export interface AdminPaymentMetrics {
  range: { from: string; to: string };
  totals: {
    bookings: number;
    gross_cents: number;
    refunded_cents: number;
    paid_out_cents: number;
    commission_cents: number;
  };
  by_week: Array<{
    week_start: string;
    bookings: number;
    gross_cents: number;
    refunded_cents: number;
    paid_out_cents: number;
    commission_cents: number;
  }>;
  current: {
    payments_enabled: boolean;
    open_reservations: number;
    payouts_due: number;
    refunds_open: number;
    jobs_failed: number;
    disputes_open: number;
    locations_ready: number;
    offers_without_payout_account: number;
    as_of: string;
  };
}

export type AdminRefund = Tables<'payment_refunds'>;
export type AdminTransfer = Tables<'payment_transfers'>;
export type AdminDispute = Tables<'payment_disputes'>;
export type AdminJob = Tables<'payment_jobs'>;

export interface DisputeEvidence {
  paidAt: string | null;
  shortCode: string | null;
  redeemedAt: string | null;
}

export async function getAdminPaymentData(): Promise<{
  settings: PaymentSettings;
  metrics: AdminPaymentMetrics;
  bookings: LocationBooking[];
  refunds: AdminRefund[];
  transfers: AdminTransfer[];
  disputes: AdminDispute[];
  failedJobs: AdminJob[];
  evidence: Record<string, DisputeEvidence>;
}> {
  const supabase = await requirePaymentAdmin();
  const [
    settingsResult,
    metricsResult,
    bookingsResult,
    refundsResult,
    transfersResult,
    disputesResult,
    jobsResult,
  ] = await Promise.all([
    supabase.rpc('get_payment_settings'),
    supabase.rpc('get_admin_payment_metrics'),
    supabase.rpc('get_location_bookings', {
      p_limit: 500,
      p_offset: 0,
    }),
    supabase
      .from('payment_refunds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('payment_transfers')
      .select('*')
      .order('transferred_at', { ascending: false })
      .limit(50),
    supabase
      .from('payment_disputes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('payment_jobs')
      .select('*')
      .eq('status', 'fehlgeschlagen')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (
    settingsResult.error ||
    metricsResult.error ||
    bookingsResult.error ||
    refundsResult.error ||
    transfersResult.error ||
    disputesResult.error ||
    jobsResult.error
  ) {
    throw new Error('Die Admin-Übersicht konnte nicht geladen werden. Bitte versuche es erneut.');
  }

  const disputes = disputesResult.data ?? [];
  const bookingIds = [
    ...new Set(disputes.flatMap((dispute) => (dispute.booking_id ? [dispute.booking_id] : []))),
  ];
  let evidence: Record<string, DisputeEvidence> = {};
  if (bookingIds.length > 0) {
    const { data: paidBookings, error: paidBookingsError } = await supabase
      .from('paid_bookings')
      .select('id, paid_at, voucher_id')
      .in('id', bookingIds);
    if (paidBookingsError)
      throw new Error('Belege zu den Rückbuchungen konnten nicht geladen werden.');

    const voucherIds = (paidBookings ?? []).flatMap((booking) =>
      booking.voucher_id ? [booking.voucher_id] : [],
    );
    const voucherResult = voucherIds.length
      ? await supabase.from('vouchers').select('id, short_code, redeemed_at').in('id', voucherIds)
      : { data: [], error: null };
    if (voucherResult.error)
      throw new Error('Einlösedaten zu den Rückbuchungen konnten nicht geladen werden.');

    const vouchersById = new Map(
      (voucherResult.data ?? []).map((voucher) => [voucher.id, voucher]),
    );
    evidence = Object.fromEntries(
      (paidBookings ?? []).map((booking) => {
        const voucher = booking.voucher_id ? vouchersById.get(booking.voucher_id) : undefined;
        return [
          booking.id,
          {
            paidAt: booking.paid_at,
            shortCode: voucher?.short_code ?? null,
            redeemedAt: voucher?.redeemed_at ?? null,
          },
        ];
      }),
    );
  }

  const settings = settingsResult.data?.[0];
  if (!settings) throw new Error('Zahlungseinstellungen fehlen.');

  return {
    settings,
    metrics: (metricsResult.data ?? {}) as unknown as AdminPaymentMetrics,
    bookings: bookingsResult.data ?? [],
    refunds: refundsResult.data ?? [],
    transfers: transfersResult.data ?? [],
    disputes,
    failedJobs: jobsResult.data ?? [],
    evidence,
  };
}
