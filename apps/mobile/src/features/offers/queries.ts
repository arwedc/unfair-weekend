/** Daten-Hooks (TanStack Query): laden, zwischenspeichern, neu laden. */
import { useQuery } from '@tanstack/react-query';

import { fetchLocationOffers, fetchLocations, fetchOffer, fetchOffers, fetchSettings } from './api';

export const offerKeys = {
  all: ['offers'] as const,
  feed: () => [...offerKeys.all, 'feed'] as const,
  detail: (offerId: string) => [...offerKeys.all, 'detail', offerId] as const,
  byLocation: (locationId: string) => [...offerKeys.all, 'location', locationId] as const,
};

export const locationKeys = {
  all: ['locations'] as const,
  detail: (locationId: string) => [...locationKeys.all, locationId] as const,
};

/** Feed und Karte teilen sich diese Abfrage. */
export function useOffers() {
  return useQuery({ queryKey: offerKeys.feed(), queryFn: fetchOffers });
}

export function useOffer(offerId: string) {
  return useQuery({ queryKey: offerKeys.detail(offerId), queryFn: () => fetchOffer(offerId) });
}

export function useLocation(locationId: string) {
  return useQuery({
    queryKey: locationKeys.detail(locationId),
    queryFn: async () => (await fetchLocations([locationId]))[0] ?? null,
  });
}

/** Einstellungen ändern sich selten, deshalb lange frisch. */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'] as const,
    queryFn: fetchSettings,
    staleTime: 10 * 60_000,
  });
}

export function useLocationOffers(locationId: string) {
  return useQuery({
    queryKey: offerKeys.byLocation(locationId),
    queryFn: () => fetchLocationOffers(locationId),
  });
}
