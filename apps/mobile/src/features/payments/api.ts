/**
 * Zahlungen (Variante B). Stripe spricht die App nur über Edge Functions an, nie direkt.
 * Vertrag: docs/BACKEND.md, Abschnitt „Zahlungen“.
 */
import { toApiError } from '@/lib/api-error';
import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

import type { PaidBooking } from './checkout-logic';

export interface PaymentSettings {
  payments_enabled: boolean;
  commission_bps: number;
  reservation_minutes: number;
  payout_delay_hours: number;
}

/** Flag und Regeln. Auswertung nur über bookingMode() aus @repo/shared. */
export async function fetchPaymentSettings(): Promise<PaymentSettings | null> {
  const { data, error } = await supabase.rpc('get_payment_settings');
  if (error) throw toApiError(error);
  return data[0] ?? null;
}

export interface StartedPaidBooking {
  booking_id: string;
  client_secret: string;
  amount_cents: number;
  currency: string;
  reserved_until: string;
  server_now: string;
}

/** Reserviert die Plätze und legt den PaymentIntent an (stripe-create-booking). */
export function startPaidBooking(offerId: string, seats: number): Promise<StartedPaidBooking> {
  return invokeFunction<StartedPaidBooking>('stripe-create-booking', { offer_id: offerId, seats });
}

export interface CancelledPaidBooking {
  booking_id: string;
  status: PaidBooking['status'];
  refund_amount_cents: number | null;
  refund_status: string | null;
}

/** Reservierung freigeben bzw. bezahlte Buchung stornieren (Erstattung sofort). */
export function cancelPaidBooking(bookingId: string): Promise<CancelledPaidBooking> {
  return invokeFunction<CancelledPaidBooking>('stripe-cancel-booking', { booking_id: bookingId });
}

export async function fetchPaidBooking(bookingId: string): Promise<PaidBooking | null> {
  const { data, error } = await supabase
    .from('paid_bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw toApiError(error);
  return data;
}

/** Eigene Buchungen (RLS: nur die des angemeldeten Nutzers). */
export async function fetchMyPaidBookings(): Promise<PaidBooking[]> {
  const { data, error } = await supabase
    .from('paid_bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw toApiError(error);
  return data;
}
