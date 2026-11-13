import type { OfferCategory } from '@repo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth, userKeys } from '@/features/auth/auth-context';
import { fetchLocations } from '@/features/offers/api';
import { locationKeys, useOffers } from '@/features/offers/queries';
import type { FeedOffer } from '@/features/offers/types';

import {
  fetchFavoriteCategories,
  fetchFavoriteLocationIds,
  fetchFavoriteOfferIds,
  setFavoriteCategory,
  setFavoriteLocation,
  setFavoriteOffer,
} from './api';

/** Unter userKeys.all, damit Abmelden auch diese Daten verwirft. */
const favoriteOffersKey = (userId: string) => [...userKeys.all, userId, 'favorite-offers'] as const;

/** IDs der gemerkten Angebote, zuletzt gemerkte zuerst. Leer ohne Konto. */
export function useFavoriteOfferIds() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: favoriteOffersKey(userId ?? 'anon'),
    queryFn: fetchFavoriteOfferIds,
    enabled: userId !== null,
  });
}

/**
 * Gemerkte Angebote, die man noch holen kann (aus dem Feed), zuletzt gemerkte zuerst.
 * Vorbei oder entfernt: verschwinden einfach aus der Liste.
 */
export function useFavoriteOffers(): { offers: FeedOffer[]; isPending: boolean } {
  const { userId } = useAuth();
  const ids = useFavoriteOfferIds();
  const feed = useOffers();
  const byId = new Map((feed.data ?? []).map((offer) => [offer.id, offer]));
  const offers = (ids.data ?? []).flatMap((id) => {
    const offer = byId.get(id);
    return offer ? [offer] : [];
  });
  // Ohne Konto ist die (abgeschaltete) Abfrage dauerhaft „pending“: dann gibt es einfach keine.
  return { offers, isPending: (userId !== null && ids.isPending) || feed.isPending };
}

export function useFavoriteLocationIds() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: userKeys.favoriteLocations(userId ?? 'anon'),
    queryFn: fetchFavoriteLocationIds,
    enabled: userId !== null,
  });
}

export function useFavoriteCategories() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: userKeys.favoriteCategories(userId ?? 'anon'),
    queryFn: fetchFavoriteCategories,
    enabled: userId !== null,
  });
}

/** Die Lieblingsorte mit Namen und Adresse (nur freigeschaltete Standorte). */
export function useFavoriteLocations() {
  const ids = useFavoriteLocationIds();
  const sorted = [...(ids.data ?? [])].sort();
  const locations = useQuery({
    queryKey: [...locationKeys.all, 'list', sorted],
    queryFn: () => fetchLocations(sorted),
    enabled: sorted.length > 0,
  });
  return {
    locations: sorted.length > 0 ? (locations.data ?? []) : [],
    isPending: ids.isPending || (sorted.length > 0 && locations.isPending),
    error: ids.error ?? locations.error,
  };
}

/** Schaltet einen Favoriten um. Die Oberfläche reagiert sofort, bei Fehlern wird zurückgedreht. */
function useToggle<T>(
  key: readonly unknown[],
  write: (userId: string, item: T, favorite: boolean) => Promise<void>,
) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ item, favorite }: { item: T; favorite: boolean }) => {
      if (!userId) return Promise.reject(new Error('NICHT_ANGEMELDET'));
      return write(userId, item, favorite);
    },
    onMutate: async ({ item, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<T[]>(key);
      queryClient.setQueryData<T[]>(key, (current = []) =>
        favorite
          ? current.includes(item)
            ? current
            : [...current, item]
          : current.filter((entry) => entry !== item),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useToggleFavoriteLocation() {
  const { userId } = useAuth();
  return useToggle<string>(userKeys.favoriteLocations(userId ?? 'anon'), setFavoriteLocation);
}

export function useToggleFavoriteCategory() {
  const { userId } = useAuth();
  return useToggle<OfferCategory>(
    userKeys.favoriteCategories(userId ?? 'anon'),
    setFavoriteCategory,
  );
}

export function useToggleFavoriteOffer() {
  const { userId } = useAuth();
  return useToggle<string>(favoriteOffersKey(userId ?? 'anon'), setFavoriteOffer);
}
