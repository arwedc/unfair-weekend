import 'server-only';
import type { Enums, RpcRow, Tables } from '@repo/shared';
import { createClient } from '@/lib/supabase/server';

/** Eine Zeile der Gästeliste (`get_offer_participants_paid`, ohne E-Mail). */
export type Participant = RpcRow<'get_offer_participants_paid'>;

/** Gästeliste eines eigenen Angebots, aktive Codes zuerst. */
export async function getParticipants(offerId: string): Promise<Participant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_offer_participants_paid', {
    p_offer_id: offerId,
  });
  if (error) throw new Error(`Gästeliste konnte nicht geladen werden: ${error.message}`);
  return data ?? [];
}

/** QR-Token: 32 Zufallsbytes als base64url (43 Zeichen). Großzügig geprüft, nur gegen Unsinn. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

export function isTokenLike(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export interface VoucherPreview {
  id: string;
  shortCode: string;
  seats: number;
  status: Enums<'voucher_status'>;
  redeemedAt: string | null;
  guestName: string | null;
  offer: Pick<Tables<'offers'>, 'id' | 'title' | 'type' | 'starts_at' | 'ends_at'>;
}

/**
 * Code zu einem gescannten QR-Token, nur zum Anzeigen (löst nichts ein).
 * RLS liefert nur Codes zu Angeboten des eigenen Standorts. `null` heißt:
 * gibt es nicht oder gehört zu einem anderen Standort.
 */
export async function getVoucherByToken(token: string): Promise<VoucherPreview | null> {
  if (!isTokenLike(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vouchers')
    .select(
      'id, short_code, seats, status, redeemed_at, offers(id, title, type, starts_at, ends_at)',
    )
    .eq('token', token)
    .maybeSingle();
  if (error || !data?.offers) return null;

  const participants = await getParticipants(data.offers.id).catch(() => []);
  const guest = participants.find((p) => p.voucher_id === data.id);

  return {
    id: data.id,
    shortCode: data.short_code,
    seats: data.seats,
    status: data.status,
    redeemedAt: data.redeemed_at,
    guestName: guest ? guestName(guest) : null,
    offer: data.offers,
  };
}

/** „Mia K.“ bzw. „Gelöschtes Konto“ (kommt so aus der DB). */
export function guestName(p: Pick<Participant, 'first_name' | 'last_initial'>): string {
  return p.last_initial ? `${p.first_name} ${p.last_initial}.` : p.first_name;
}
