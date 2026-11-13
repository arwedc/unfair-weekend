/**
 * Favoriten: Lieblingsorte und Lieblingskategorien.
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
