/**
 * Vertrauens-Infos für die Angebotskarten: Bewertung des Anbieters und Entfernung.
 * Der Bildschirm lädt die Bewertungen einmal für alle Karten und stellt sie hier bereit,
 * statt dass jede Karte selbst fragt. Ohne Provider zeigen die Karten die Zeile einfach nicht.
 */
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { distanceKm } from '@/features/offers/cities';
import type { LocationRatingSummary } from '@/features/offers/feed-logic';
import type { Offer } from '@/features/offers/types';
import { peekPosition, type Coordinates } from '@/lib/location';

interface OfferMeta {
  ratings?: ReadonlyMap<string, LocationRatingSummary>;
  position: Coordinates | null;
}

const OfferMetaContext = createContext<OfferMeta>({ position: null });

/** Wie oft nachgeschaut wird, ob der Standort inzwischen bekannt ist. */
const POSITION_POLL_MS = 3000;

/**
 * Bekannter Standort aus dieser Sitzung, ohne selbst nach der Erlaubnis zu fragen.
 * Den Standort holt „Entdecken“ beim Start; bis er da ist, wird kurz nachgeschaut.
 */
function useKnownPosition(): Coordinates | null {
  const [position, setPosition] = useState<Coordinates | null>(() => peekPosition());
  useEffect(() => {
    if (position) return;
    const timer = setInterval(() => {
      const known = peekPosition();
      if (known) setPosition(known);
    }, POSITION_POLL_MS);
    return () => clearInterval(timer);
  }, [position]);
  return position;
}

export function OfferMetaProvider({
  ratings,
  children,
}: {
  ratings?: ReadonlyMap<string, LocationRatingSummary>;
  children: ReactNode;
}) {
  const position = useKnownPosition();
  return <OfferMetaContext value={{ ratings, position }}>{children}</OfferMetaContext>;
}

/** Bewertung (nur mit mindestens einer Bewertung) und Entfernung in km für ein Angebot. */
export function useOfferMeta(offer: Pick<Offer, 'location_id' | 'lat' | 'lng'>): {
  rating: LocationRatingSummary | null;
  distance: number | null;
} {
  const { ratings, position } = use(OfferMetaContext);
  const found = ratings?.get(offer.location_id);
  const rating = found && found.count > 0 ? found : null;
  const lat = offer.lat as number | null;
  const lng = offer.lng as number | null;
  const distance =
    position && lat !== null && lng !== null ? distanceKm(position, { lat, lng }) : null;
  return { rating, distance };
}
