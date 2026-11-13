/** Angebote mit allen Filtern (inkl. Lieblingsorte). Feed und Karte nutzen denselben Stand. */
import { useAuth } from '@/features/auth/auth-context';
import { useFavoriteLocationIds } from '@/features/favorites/queries';

import { filterOffers } from './feed-logic';
import { useOfferFilters } from './filters-context';
import { useOffers } from './queries';

export function useFilteredOffers() {
  const query = useOffers();
  const { filters } = useOfferFilters();
  const { userId } = useAuth();
  const favorites = useFavoriteLocationIds();

  const favoriteIds = userId && favorites.data ? new Set(favorites.data) : undefined;
  const visible = filterOffers(query.data ?? [], filters, new Date(), favoriteIds);

  return { ...query, visible };
}
