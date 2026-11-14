import type { OfferCategory } from '@repo/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth, userKeys } from '@/features/auth/auth-context';
import { locationKeys } from '@/features/offers/queries';

import {
  fetchFavoriteCategories,
  fetchFavoriteLocationIds,
  fetchFavoriteLocations,
  setFavoriteCategory,
  setFavoriteLocation,
} from './api';

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

/**
 * Die Lieblingsorte mit Namen, Adresse und Galerie (nur freigeschaltete Standorte).
 * Beim Entfernen bleibt die alte Liste stehen und wird nur gefiltert, damit nichts aufblitzt.
 */
export function useFavoriteLocations() {
  const ids = useFavoriteLocationIds();
  const sorted = [...(ids.data ?? [])].sort();
  const locations = useQuery({
    queryKey: [...locationKeys.all, 'favorites', sorted],
    queryFn: () => fetchFavoriteLocations(sorted),
    enabled: sorted.length > 0,
    placeholderData: keepPreviousData,
  });
  return {
    locations: (locations.data ?? []).filter((location) => sorted.includes(location.id)),
    isPending: ids.isPending || (sorted.length > 0 && locations.isPending),
    error: ids.error ?? locations.error,
    refetch: () => Promise.all([ids.refetch(), locations.refetch()]),
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
