import { Constants, type Enums } from '../types';

/**
 * Angebotsarten (Postgres-Enum `offer_type`).
 * - einzeltermin: fester Start und festes Ende (z. B. Kochkurs Sa. 18–21 Uhr)
 * - zeitraum: einlösbar von–bis (z. B. Massage, einlösbar diese Woche)
 */
export const OFFER_TYPES = Constants.public.Enums.offer_type;
export type OfferType = Enums<'offer_type'>;

export const OFFER_TYPE_LABELS = {
  einzeltermin: 'Einzeltermin',
  zeitraum: 'Zeitraum',
} as const satisfies Record<OfferType, string>;

/** Feste Kategorien (Postgres-Enum `offer_category`). */
export const OFFER_CATEGORIES = Constants.public.Enums.offer_category;
export type OfferCategory = Enums<'offer_category'>;

export const OFFER_CATEGORY_LABELS = {
  kochen_essen: 'Kochen & Essen',
  sport_bewegung: 'Sport & Bewegung',
  kreativ_workshops: 'Kreativ & Workshops',
  wellness_beauty: 'Wellness & Beauty',
  kultur_events: 'Kultur & Events',
  sonstiges: 'Sonstiges',
} as const satisfies Record<OfferCategory, string>;

/** Status eines Angebots. „Beendet“ ist kein Status, sondern ergibt sich aus der Zeit. */
export const OFFER_STATUSES = Constants.public.Enums.offer_status;
export type OfferStatus = Enums<'offer_status'>;

export const OFFER_STATUS_LABELS = {
  aktiv: 'Aktiv',
  abgesagt: 'Abgesagt',
  entfernt: 'Entfernt',
} as const satisfies Record<OfferStatus, string>;

/** Grenzen für Angebote (gleich wie in der Datenbank). */
export const OFFER_LIMITS = {
  titleMin: 3,
  titleMax: 80,
  descriptionMin: 10,
  descriptionMax: 2000,
  imagesMin: 1,
  imagesMax: 5,
  capacityMax: 1000,
  maxPerUserMax: 20,
  addressMin: 5,
  addressMax: 200,
  originalPriceMaxCents: 10_000_000,
  maxDurationDays: 90,
} as const;
