/**
 * Favoriten: Lieblingsangebote, Lieblingsorte und Lieblingskategorien.
 * Die einzigen Tabellen, in die die App direkt schreiben darf (eigene Zeilen, per RLS abgesichert).
 */
import type { OfferCategory } from '@repo/shared';

import { toApiError } from '@/lib/api-error';
import { supabase } from '@/lib/supabase';

export async function fetchFavoriteLocationIds(): Promise<string[]> {
  const { data, error } = await supabase.from('favorite_locations').select('location_id');
  if (error) throw toApiError(error);
  return (data ?? []).map((row) => row.location_id);
}

export async function setFavoriteLocation(
  userId: string,
  locationId: string,
  favorite: boolean,
): Promise<void> {
  const { error } = favorite
    ? await supabase
        .from('favorite_locations')
        .upsert(
          { user_id: userId, location_id: locationId },
          { onConflict: 'user_id,location_id', ignoreDuplicates: true },
        )
    : await supabase
        .from('favorite_locations')
        .delete()
        .eq('user_id', userId)
        .eq('location_id', locationId);
  if (error) throw toApiError(error);
}

export async function fetchFavoriteCategories(): Promise<OfferCategory[]> {
  const { data, error } = await supabase.from('favorite_categories').select('category');
  if (error) throw toApiError(error);
  return (data ?? []).map((row) => row.category);
}

export async function setFavoriteCategory(
  userId: string,
  category: OfferCategory,
  favorite: boolean,
): Promise<void> {
  const { error } = favorite
    ? await supabase
        .from('favorite_categories')
        .upsert(
          { user_id: userId, category },
          { onConflict: 'user_id,category', ignoreDuplicates: true },
        )
    : await supabase
        .from('favorite_categories')
        .delete()
        .eq('user_id', userId)
        .eq('category', category);
  if (error) throw toApiError(error);
}

/** Gemerkte Angebote, zuletzt gemerkte zuerst. */
export async function fetchFavoriteOfferIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorite_offers')
    .select('offer_id')
    .order('created_at', { ascending: false });
  if (error) throw toApiError(error);
  return (data ?? []).map((row) => row.offer_id);
}

export async function setFavoriteOffer(
  userId: string,
  offerId: string,
  favorite: boolean,
): Promise<void> {
  const { error } = favorite
    ? await supabase
        .from('favorite_offers')
        .upsert(
          { user_id: userId, offer_id: offerId },
          { onConflict: 'user_id,offer_id', ignoreDuplicates: true },
        )
    : await supabase.from('favorite_offers').delete().eq('user_id', userId).eq('offer_id', offerId);
  if (error) throw toApiError(error);
}
