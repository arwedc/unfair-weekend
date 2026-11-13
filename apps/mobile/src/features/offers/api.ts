/** Abfragen rund um Angebote und Standorte. Alles über die RPCs aus docs/BACKEND.md. */
import { toApiError } from '@/lib/api-error';
import { supabase } from '@/lib/supabase';

import type { AppSettings, FeedOffer, Offer, OfferDetail, PublicLocation } from './types';

/** So viele Angebote liefert `list_offers` höchstens pro Aufruf. Reicht für den MVP (5–15 Partner). */
const FEED_LIMIT = 100;

async function fetchCreatedAt(offers: readonly Offer[]): Promise<Map<string, string>> {
  if (offers.length === 0) return new Map();
  const { data, error } = await supabase.rpc('list_offer_created_at', {
    p_offer_ids: offers.map((offer) => offer.id),
  });
  // „Neu dabei“ ist ein Extra: Fällt die Abfrage aus, zeigt der Feed den Abschnitt einfach nicht.
  if (error) return new Map();
  return new Map(data.map((row) => [row.id, row.created_at]));
}

/** Alle holbaren Angebote, sortiert nach „als Nächstes relevant“. */
export async function fetchOffers(): Promise<FeedOffer[]> {
  const { data, error } = await supabase.rpc('list_offers', { p_limit: FEED_LIMIT });
  if (error) throw toApiError(error);
  const createdAt = await fetchCreatedAt(data);
  return data.map((offer) => ({ ...offer, createdAt: createdAt.get(offer.id) ?? null }));
}

/** Ein Angebot für die Detailseite. `null`, wenn es nicht (mehr) sichtbar ist. */
export async function fetchOffer(offerId: string): Promise<OfferDetail | null> {
  const { data, error } = await supabase.rpc('get_offer', { p_offer_id: offerId });
  if (error) throw toApiError(error);
  return data[0] ?? null;
}

/** Zählt den Aufruf der Detailseite. Wirft nie, Kennzahlen dürfen die App nicht stören. */
export async function logOfferView(offerId: string): Promise<void> {
  try {
    await supabase.rpc('log_offer_view', { p_offer_id: offerId });
  } catch {
    // bewusst ignoriert
  }
}

/** Freigeschaltete Standorte zu den IDs (max. 100). Unbekannte IDs fehlen im Ergebnis. */
export async function fetchLocations(locationIds: readonly string[]): Promise<PublicLocation[]> {
  if (locationIds.length === 0) return [];
  const { data, error } = await supabase.rpc('get_locations_public', {
    p_location_ids: [...locationIds],
  });
  if (error) throw toApiError(error);
  return data;
}

/** Admin-Einstellungen, z. B. die Stornofrist in Stunden. */
export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.rpc('get_settings');
  if (error) throw toApiError(error);
  return data;
}

/** Holbare Angebote eines Standorts. */
export async function fetchLocationOffers(locationId: string): Promise<Offer[]> {
  const { data, error } = await supabase.rpc('list_offers', {
    p_location_ids: [locationId],
    p_limit: FEED_LIMIT,
  });
  if (error) throw toApiError(error);
  return data;
}
