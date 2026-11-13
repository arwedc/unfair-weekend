/** Gutscheincodes holen, anzeigen und stornieren. Die Regeln prüft allein der Server. */
import { toApiError } from '@/lib/api-error';
import { supabase } from '@/lib/supabase';

import type { Voucher } from './voucher-logic';

export async function fetchMyVouchers(): Promise<Voucher[]> {
  const { data, error } = await supabase.rpc('get_my_vouchers');
  if (error) throw toApiError(error);
  return data ?? [];
}

/** Holt einen Code für `seats` Plätze. Liefert die ID des neuen Codes. */
export async function claimVoucher(offerId: string, seats: number): Promise<string> {
  const { data, error } = await supabase.rpc('claim_voucher', {
    p_offer_id: offerId,
    p_seats: seats,
  });
  if (error) throw toApiError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ?? '';
}

export async function cancelVoucher(voucherId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_voucher', { p_voucher_id: voucherId });
  if (error) throw toApiError(error);
}
