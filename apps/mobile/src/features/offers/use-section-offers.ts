/**
 * Alle Angebote eines Feed-Abschnitts (z. B. „Last Minute“ oder eine Kategorie-Reihe) für die
 * Abschnitts-Seite mit Karte. Gleiche Regeln wie im Feed, nur ohne die 8er-Grenze der Karussells.
 */
import { OFFER_CATEGORIES, type OfferCategory } from '@repo/shared';

import { useT } from '@/lib/i18n/context';

import { getCity, offersInCity } from './cities';
import { buildSections, filterOffers, ratingsFromOffers } from './feed-logic';
import { useOfferFilters } from './filters-context';
import { useOffers } from './queries';
import type { FeedOffer } from './types';

const CATEGORY_PREFIX = 'kategorie-';

function categoryFromKey(key: string): OfferCategory | null {
  if (!key.startsWith(CATEGORY_PREFIX)) return null;
  const value = key.slice(CATEGORY_PREFIX.length);
  return OFFER_CATEGORIES.find((category) => category === value) ?? null;
}

export function useSectionOffers(key: string) {
  const { locale, labels } = useT();
  const { filters, cityId } = useOfferFilters();
  const { data, error, isPending, refetch } = useOffers();
  const cityOffers = offersInCity(data ?? [], cityId);
  const visible = filterOffers(cityOffers, filters);
  const ratings = ratingsFromOffers(cityOffers);

  const category = categoryFromKey(key);
  const section = category
    ? null
    : buildSections(visible, { locale, ratings, now: new Date(), limit: Infinity }).find(
        (item) => item.key === key,
      );
  const title = category ? labels.offerCategory[category] : (section?.title ?? '');
  const offers: FeedOffer[] = category
    ? visible.filter((offer) => offer.category === category)
    : (section?.offers ?? []);

  return { title, offers, city: getCity(cityId), error, isPending, refetch };
}
