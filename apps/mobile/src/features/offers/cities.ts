/**
 * Städte, zwischen denen man oben im Feed wechseln kann.
 *
 * Die Datenbank kennt (noch) keine Stadt am Angebot. Die App ordnet jedes Angebot deshalb
 * über seine Koordinaten der nächstgelegenen Stadt zu. Bekommt das Backend später eine
 * Stadt-Spalte, ersetzt sie diese Zuordnung.
 */
import type { Offer } from './types';

export interface City {
  id: string;
  name: string;
  /** Kartenmitte (Rathaus bzw. Altstadt). */
  center: { lat: number; lng: number };
  /** Schon mit Partnern gestartet? Sonst zeigt der Feed „Bald auch in …“. */
  launched: boolean;
}

export const CITIES = [
  { id: 'muenster', name: 'Münster', center: { lat: 51.9607, lng: 7.6261 }, launched: true },
  { id: 'vilnius', name: 'Vilnius', center: { lat: 54.6872, lng: 25.2797 }, launched: false },
] as const satisfies readonly City[];

export type CityId = (typeof CITIES)[number]['id'];

/** Startstadt beim ersten Öffnen und für Angebote ohne Koordinaten. */
export const DEFAULT_CITY_ID: CityId = 'muenster';

export function isCityId(value: unknown): value is CityId {
  return CITIES.some((city) => city.id === value);
}

export function getCity(id: CityId): City {
  return CITIES.find((city) => city.id === id) ?? CITIES[0];
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Luftlinie in Kilometern (Haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

type Located = Pick<Offer, 'lat' | 'lng'>;

/**
 * Stadt eines Angebots: die nächstgelegene. So geht kein Angebot verloren, auch wenn
 * es etwas außerhalb liegt. Ohne Koordinaten zählt es zur Startstadt.
 */
export function cityOfOffer(offer: Located): CityId {
  // Die Typen sagen number, in der DB können die Koordinaten aber fehlen.
  const lat = offer.lat as number | null;
  const lng = offer.lng as number | null;
  if (lat === null || lng === null) return DEFAULT_CITY_ID;

  let nearest: { id: CityId; distance: number } | null = null;
  for (const city of CITIES) {
    const distance = distanceKm(city.center, { lat, lng });
    if (nearest === null || distance < nearest.distance) nearest = { id: city.id, distance };
  }
  return nearest?.id ?? DEFAULT_CITY_ID;
}

export function offersInCity<T extends Located>(offers: readonly T[], cityId: CityId): T[] {
  return offers.filter((offer) => cityOfOffer(offer) === cityId);
}

/** Anzahl Angebote je Stadt, z. B. für die Städteauswahl. */
export function countOffersByCity(offers: readonly Located[]): Record<CityId, number> {
  const counts = Object.fromEntries(CITIES.map((city) => [city.id, 0])) as Record<CityId, number>;
  for (const offer of offers) counts[cityOfOffer(offer)] += 1;
  return counts;
}
