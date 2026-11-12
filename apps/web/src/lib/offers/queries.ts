import 'server-only';
import type { Tables } from '@repo/shared';
import { createClient } from '@/lib/supabase/server';

export type Offer = Tables<'offers'>;

/** Eigene Angebote des Standorts (RLS liefert nur diese), neueste Termine zuerst. */
export async function listMyOffers(): Promise<Offer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('relevant_at', { ascending: false });
  if (error) throw new Error(`Angebote konnten nicht geladen werden: ${error.message}`);
  return data;
}

export async function getMyOffer(id: string): Promise<Offer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('offers').select('*').eq('id', id).maybeSingle();
  if (error) return null;
  return data;
}

/**
 * Gibt es schon Codes (aktiv, eingelöst oder No-Show)? Dann sperrt `update_offer`
 * Zeit, Adresse und Preise (wie `private.offer_has_codes`).
 */
export async function offerHasCodes(offerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('vouchers')
    .select('id', { count: 'exact', head: true })
    .eq('offer_id', offerId)
    .in('status', ['aktiv', 'eingeloest', 'no_show']);
  return (count ?? 0) > 0;
}

/** Aktuelle Admin-Einstellungen (Mindestrabatt). `settings` ist für alle lesbar. */
export async function getMinDiscountPercent(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('min_discount_percent').maybeSingle();
  return data?.min_discount_percent ?? 20;
}

/** Adresse des eigenen Standorts als Vorbelegung für neue Angebote. */
export async function getMyLocationAddress(
  locationId: string,
): Promise<{ street: string; postal_code: string; city: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('street, postal_code, city')
    .eq('id', locationId)
    .maybeSingle();
  return data ?? { street: '', postal_code: '', city: '' };
}
