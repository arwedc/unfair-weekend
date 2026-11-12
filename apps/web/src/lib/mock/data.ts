/**
 * MOCK-Datenschicht, solange das Supabase-Backend entsteht.
 * Alles liegt im Arbeitsspeicher des Dev-Servers und ist nach einem Neustart weg.
 * Die Signaturen sind so gewählt, dass sie später durch Supabase-Aufrufe (RPCs) ersetzt werden können.
 */
import 'server-only';
import type { OfferType } from '@repo/shared';
import type { Category } from '@/lib/offers/categories';
import type { CreateOfferInput } from '@/lib/offers/schema';

export interface Location {
  id: string;
  companyName: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  email: string;
}

export interface Offer {
  id: string;
  locationId: string;
  title: string;
  description: string;
  category: Category;
  type: OfferType;
  startsAt: string;
  endsAt: string;
  originalPriceCents: number;
  dealPriceCents: number;
  capacity: number;
  claimedSeats: number;
  maxPerUser: number;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
}

/** Passwort für alle Demo-Zugänge. */
export const MOCK_PASSWORD = 'demo1234';

/** Fiktive Standorte, keine echten Unternehmen. */
const LOCATIONS: Location[] = [
  {
    id: 'loc-kochwerk',
    companyName: 'TEST Kochwerk',
    name: 'TEST Kochwerk Hafen',
    address: 'Hafenweg 10, 48155 Münster',
    lat: 51.9497,
    lng: 7.6402,
    email: 'kochwerk@example.com',
  },
  {
    id: 'loc-atemraum',
    companyName: 'TEST Atemraum',
    name: 'TEST Atemraum Kreuzviertel',
    address: 'Beispielstraße 5, 48147 Münster',
    lat: 51.9688,
    lng: 7.6181,
    email: 'atemraum@example.com',
  },
];

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function seedOffers(): Offer[] {
  const kochwerk = LOCATIONS[0]!;
  return [
    {
      id: 'off-seed-1',
      locationId: kochwerk.id,
      title: 'Pasta-Abend: Ravioli selbst gemacht',
      description: 'Drei Stunden frische Pasta, zwei Füllungen und ein Glas Wein zum Abschluss.',
      category: 'Kochen & Essen',
      type: 'einzeltermin',
      startsAt: hoursFromNow(30),
      endsAt: hoursFromNow(33),
      originalPriceCents: 6900,
      dealPriceCents: 3900,
      capacity: 10,
      claimedSeats: 7,
      maxPerUser: 2,
      address: kochwerk.address,
      lat: kochwerk.lat,
      lng: kochwerk.lng,
      createdAt: hoursFromNow(-20),
    },
  ];
}

// Bleibt über HMR-Neuladungen im Dev-Server erhalten.
const store = globalThis as unknown as { __mockOffers?: Offer[] };
store.__mockOffers ??= seedOffers();
const offers = store.__mockOffers;

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

export async function findLocationByCredentials(
  email: string,
  password: string,
): Promise<Location | null> {
  await delay();
  const location = LOCATIONS.find((l) => l.email === email.trim().toLowerCase());
  return location && password === MOCK_PASSWORD ? location : null;
}

export async function getLocation(id: string): Promise<Location | null> {
  return LOCATIONS.find((l) => l.id === id) ?? null;
}

export function listDemoLogins(): { email: string; name: string }[] {
  return LOCATIONS.map((l) => ({ email: l.email, name: l.name }));
}

export async function listOffers(locationId: string): Promise<Offer[]> {
  await delay();
  return offers
    .filter((o) => o.locationId === locationId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function createOffer(location: Location, input: CreateOfferInput): Promise<Offer> {
  await delay(300);
  const offer: Offer = {
    ...input,
    id: `off-${crypto.randomUUID()}`,
    locationId: location.id,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    claimedSeats: 0,
    // Geokodierung kommt mit dem Backend, bis dahin die Koordinaten des Standorts.
    lat: location.lat,
    lng: location.lng,
    createdAt: new Date().toISOString(),
  };
  offers.push(offer);
  return offer;
}
