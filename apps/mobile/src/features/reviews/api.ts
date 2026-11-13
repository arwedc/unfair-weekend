/** Bewertungen: RPCs aus docs/BACKEND.md und die eigenen Zeilen direkt (RLS zeigt nur eigene). */
import type { RpcRow } from '@repo/shared/types';

import { toApiError } from '@/lib/api-error';
import { supabase } from '@/lib/supabase';

/** Eine sichtbare Bewertung (aus `list_location_reviews`). */
export type LocationReview = RpcRow<'list_location_reviews'>;

/** Anzahl und Durchschnitt eines Standorts (aus `get_location_ratings`). */
export type LocationRating = RpcRow<'get_location_ratings'>;

/** Eigene Bewertung, um zu wissen, welcher Ort schon bewertet ist. */
export interface MyReview {
  id: string;
  voucher_id: string;
  location_id: string;
  rating: number;
}

export const REVIEWS_PAGE_SIZE = 20;

export async function fetchLocationReviews(locationId: string): Promise<LocationReview[]> {
  const { data, error } = await supabase.rpc('list_location_reviews', {
    p_location_id: locationId,
    p_limit: REVIEWS_PAGE_SIZE,
  });
  if (error) throw toApiError(error);
  return data;
}

/** Durchschnitt und Anzahl. `null`, wenn der Ort noch keine sichtbare Bewertung hat. */
export async function fetchLocationRating(locationId: string): Promise<LocationRating | null> {
  const { data, error } = await supabase.rpc('get_location_ratings', {
    p_location_ids: [locationId],
  });
  if (error) throw toApiError(error);
  return data[0] ?? null;
}

export async function fetchMyReviews(): Promise<MyReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, voucher_id, location_id, rating');
  if (error) throw toApiError(error);
  return data;
}

export async function createReview(input: {
  voucherId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const { error } = await supabase.rpc('create_review', {
    p_voucher_id: input.voucherId,
    p_rating: input.rating,
    p_comment: input.comment.trim() || undefined,
  });
  if (error) throw toApiError(error);
}
