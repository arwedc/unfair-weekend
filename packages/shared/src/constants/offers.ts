/**
 * Angebotsarten. Die Werte entsprechen dem Postgres-Enum `offer_type`.
 * - einzeltermin: fester Start und festes Ende (z. B. Kochkurs Sa. 18–21 Uhr)
 * - zeitraum: einlösbar von–bis (z. B. Massage, einlösbar diese Woche)
 */
export const OFFER_TYPES = ['einzeltermin', 'zeitraum'] as const;

export type OfferType = (typeof OFFER_TYPES)[number];

export const OFFER_TYPE_LABELS = {
  einzeltermin: 'Einzeltermin',
  zeitraum: 'Zeitraum',
} as const satisfies Record<OfferType, string>;
