/** Daten-Hooks für Bewertungen (TanStack Query). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth, userKeys } from '@/features/auth/auth-context';

import {
  createReview,
  fetchLocationRating,
  fetchLocationRatings,
  fetchLocationReviews,
  fetchMyReviews,
} from './api';

export const reviewKeys = {
  all: ['reviews'] as const,
  location: (locationId: string) => [...reviewKeys.all, 'location', locationId] as const,
  rating: (locationId: string) => [...reviewKeys.all, 'rating', locationId] as const,
  ratings: (locationIds: readonly string[]) =>
    [...reviewKeys.all, 'ratings', ...locationIds] as const,
  mine: (userId: string) => [...userKeys.all, userId, 'reviews'] as const,
};

export function useLocationReviews(locationId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reviewKeys.location(locationId),
    queryFn: () => fetchLocationReviews(locationId),
    enabled: (options.enabled ?? true) && locationId !== '',
  });
}

export function useLocationRating(locationId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reviewKeys.rating(locationId),
    queryFn: () => fetchLocationRating(locationId),
    enabled: (options.enabled ?? true) && locationId !== '',
  });
}

/** Bewertungen vieler Standorte als Map (`location_id` → Schnitt und Anzahl). */
export function useLocationRatings(locationIds: readonly string[]) {
  const ids = [...new Set(locationIds)].sort();
  return useQuery({
    queryKey: reviewKeys.ratings(ids),
    queryFn: async () => {
      const rows = await fetchLocationRatings(ids);
      return new Map(
        rows.map((row) => [
          row.location_id,
          { average: row.average_rating, count: row.review_count },
        ]),
      );
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
}

/** Eigene Bewertungen. Lädt nur, wenn jemand angemeldet ist. */
export function useMyReviews() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: reviewKeys.mine(userId ?? 'anon'),
    queryFn: fetchMyReviews,
    enabled: userId !== null,
  });
}

/** Die eigene Bewertung eines Ortes, falls es eine gibt. */
export function useMyReviewForLocation(locationId: string) {
  const { data } = useMyReviews();
  return data?.find((review) => review.location_id === locationId) ?? null;
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReview,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
        queryClient.invalidateQueries({ queryKey: userKeys.all }),
      ]),
  });
}
