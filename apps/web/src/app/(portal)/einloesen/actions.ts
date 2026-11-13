'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { parseRpcError, redeemCodeSchema } from '@repo/shared';
import { translateValidationMessage } from '@repo/shared/i18n';
import { requireAccount } from '@/lib/auth';
import { guestName } from '@/lib/checkin/queries';
import { getT } from '@/lib/i18n/locale';
import { createClient } from '@/lib/supabase/server';

export interface RedeemedCode {
  guest: string;
  seats: number;
  shortCode: string;
  offerId: string;
  offerTitle: string;
}

export interface RedeemState {
  ok?: RedeemedCode;
  error?: string;
  /** Eingabe nach einem Fehler wieder ins Feld schreiben. */
  input?: string;
}

/** Wurde ein ganzer QR-Link eingefügt, nur den Token daraus nehmen. */
function extractCode(input: string): string {
  const match = /\/einloesen\/([A-Za-z0-9_-]+)/.exec(input);
  return match?.[1] ?? input;
}

/**
 * Löst einen Code ein (`redeem_voucher`): Kurzcode, QR-Token oder eingefügter QR-Link.
 * Formularfeld `code`. Die Regeln (eigener Standort, Zeitfenster, doppelt) prüft der Server.
 */
export async function redeemCodeAction(
  _prev: RedeemState,
  formData: FormData,
): Promise<RedeemState> {
  await requireAccount();
  const { locale, t } = await getT();
  const input = String(formData.get('code') ?? '').trim();

  const parsed = redeemCodeSchema.safeParse({ code: input });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return { error: issue ? translateValidationMessage(issue, locale) : t.checkin.failed, input };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('redeem_voucher', {
    p_code: extractCode(parsed.data.code),
  });
  if (error) return { error: parseRpcError(error, locale)?.message ?? t.checkin.failed, input };

  const row = data?.[0];
  if (!row) return { error: t.checkin.failed, input };

  revalidatePath(`/angebote/${row.offer_id}`);
  return {
    ok: {
      guest: guestName(row),
      seats: row.seats,
      shortCode: row.short_code,
      offerId: row.offer_id,
      offerTitle: row.offer_title,
    },
  };
}

export interface NoShowState {
  error?: string;
}

const noShowInput = z.object({
  voucherId: z.uuid(),
  offerId: z.uuid(),
  paid: z.enum(['0', '1']),
});

/**
 * Markiert einen Code als nicht erschienen. Bezahlte Codes laufen über
 * `mark_paid_no_show` (ohne Zähler und Sperre), alle anderen über `mark_no_show`.
 */
export async function markNoShowAction(
  _prev: NoShowState,
  formData: FormData,
): Promise<NoShowState> {
  await requireAccount();
  const { locale, t } = await getT();
  const parsed = noShowInput.safeParse({
    voucherId: formData.get('voucher_id'),
    offerId: formData.get('offer_id'),
    paid: formData.get('paid'),
  });
  if (!parsed.success) return { error: t.checkin.guests.noShowFailed };

  const { voucherId, offerId, paid } = parsed.data;
  const supabase = await createClient();
  const { error } =
    paid === '1'
      ? await supabase.rpc('mark_paid_no_show', { p_voucher_id: voucherId })
      : await supabase.rpc('mark_no_show', { p_voucher_id: voucherId });
  if (error)
    return { error: parseRpcError(error, locale)?.message ?? t.checkin.guests.noShowFailed };

  revalidatePath(`/angebote/${offerId}`);
  return {};
}
