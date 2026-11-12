/**
 * Feste Kategorienliste aus der SPEC.
 * TODO: nach @repo/shared verschieben, sobald das Backend das Enum festlegt (eigener backend-PR).
 */
export const CATEGORIES = [
  'Kochen & Essen',
  'Sport & Bewegung',
  'Kreativ & Workshops',
  'Wellness & Beauty',
  'Kultur & Events',
  'Sonstiges',
] as const;

export type Category = (typeof CATEGORIES)[number];
