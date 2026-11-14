import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ReviewSort } from './filters';

export const REVIEWS_PAGE_SIZE = 20;

export interface ReviewSummary {
  reviewCount: number;
  /** Durchschnitt der sichtbaren Bewertungen, `null` ohne Bewertung. */
  averageRating: number | null;
  /** Anzahl je Sternzahl, Index 0 = 1 Stern. */
  distribution: [number, number, number, number, number];
  hiddenCount: number;
  last30Days: number;
}

export interface LocationReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
  offerId: string | null;
  offerTitle: string | null;
  isHidden: boolean;
}

/** Übersicht über die Bewertungen des eigenen Standorts (get_my_review_summary). */
export async function getMyReviewSummary(): Promise<ReviewSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_my_review_summary');
  if (error) throw new Error(`Bewertungen konnten nicht geladen werden: ${error.message}`);
  const row = data[0];
  return {
    reviewCount: row?.review_count ?? 0,
    averageRating: (row?.average_rating as number | null | undefined) ?? null,
    distribution: [
      row?.rating_1 ?? 0,
      row?.rating_2 ?? 0,
      row?.rating_3 ?? 0,
      row?.rating_4 ?? 0,
      row?.rating_5 ?? 0,
    ],
    hiddenCount: row?.hidden_count ?? 0,
    last30Days: row?.last_30_days ?? 0,
  };
}

/**
 * Eine Seite Bewertungen des eigenen Standorts, auch ausgeblendete (list_my_reviews).
 * Lädt einen Eintrag mehr, um zu wissen, ob es weitergeht.
 */
export async function listMyReviews(options: {
  rating?: number;
  sort: ReviewSort;
  /** ISO-Zeitpunkt: nur Bewertungen ab hier. */
  since?: string;
  page: number;
}): Promise<{ reviews: LocationReview[]; hasMore: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_my_reviews', {
    ...(options.rating ? { p_rating: options.rating } : {}),
    ...(options.since ? { p_since: options.since } : {}),
    p_sort: options.sort,
    p_limit: REVIEWS_PAGE_SIZE + 1,
    p_offset: (options.page - 1) * REVIEWS_PAGE_SIZE,
  });
  if (error) throw new Error(`Bewertungen konnten nicht geladen werden: ${error.message}`);
  const reviews = data.slice(0, REVIEWS_PAGE_SIZE).map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: (r.comment as string | null) ?? null,
    createdAt: r.created_at,
    authorName: r.author_name,
    offerId: (r.offer_id as string | null) ?? null,
    offerTitle: (r.offer_title as string | null) ?? null,
    isHidden: r.is_hidden,
  }));
  return { reviews, hasMore: data.length > REVIEWS_PAGE_SIZE };
}
