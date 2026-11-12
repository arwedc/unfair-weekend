import type { Tables } from '@repo/shared';
import { berlinParts } from '@repo/shared/utils';

/** Namen der Formularfelder. Weitgehend wie die RPC-Parameter, Adresse ist aufgeteilt. */
export const OFFER_FORM_FIELDS = [
  'title',
  'description',
  'category',
  'type',
  'starts_at',
  'ends_at',
  'original_price',
  'deal_price',
  'capacity',
  'max_per_user',
  'street',
  'postal_code',
  'city',
] as const;

export type OfferFormField = (typeof OFFER_FORM_FIELDS)[number] | 'image_paths';

/** Felder, die `update_offer` sperrt, sobald es Codes gibt (FELD_GESPERRT). */
export const LOCKED_WHEN_CODES: readonly OfferFormField[] = [
  'type',
  'starts_at',
  'ends_at',
  'original_price',
  'deal_price',
  'street',
  'postal_code',
  'city',
];

export type OfferFormValues = Partial<Record<(typeof OFFER_FORM_FIELDS)[number], string>> & {
  image_paths?: string[];
};

export interface OfferFormState {
  errors: Partial<Record<OfferFormField, string>>;
  formError?: string;
  /** Eingaben zum Wiederbefüllen nach einem Fehler. */
  values?: OfferFormValues;
  /** Erfolgsmeldung beim Bearbeiten (die Seite bleibt offen). */
  saved?: boolean;
}

/** „29,90“, „29.90“, „29“ → Cent. `null`, wenn keine gültige Zahl. */
export function parseEuroToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Cent → „29,90“ für Eingabefelder (ohne Währungszeichen, anders als formatPrice). */
export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC-Zeitpunkt → Wert für `<input type="datetime-local">` in Berliner Ortszeit. */
export function utcToBerlinInput(iso: string): string {
  const p = berlinParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Adresse wie in `offers.address` gespeichert. */
export function joinAddress(street: string, postalCode: string, city: string): string {
  return `${street.trim()}, ${postalCode.trim()} ${city.trim()}`;
}

/** „Hafenweg 10, 48155 Münster“ → Teile. Unbekanntes Format landet komplett in `street`. */
export function splitAddress(address: string): {
  street: string;
  postal_code: string;
  city: string;
} {
  const match = /^(.+),\s*(\d{5})\s+(.+)$/.exec(address.trim());
  if (!match) return { street: address, postal_code: '', city: '' };
  return { street: match[1] ?? '', postal_code: match[2] ?? '', city: match[3] ?? '' };
}

/** Formularwerte aus einem gespeicherten Angebot (zum Bearbeiten und für gesperrte Felder). */
export function offerToFormValues(offer: Tables<'offers'>): OfferFormValues {
  return {
    title: offer.title,
    description: offer.description,
    category: offer.category,
    type: offer.type,
    starts_at: utcToBerlinInput(offer.starts_at),
    ends_at: utcToBerlinInput(offer.ends_at),
    original_price: centsToEuroInput(offer.original_price_cents),
    deal_price: centsToEuroInput(offer.deal_price_cents),
    capacity: String(offer.capacity),
    max_per_user: String(offer.max_per_user),
    ...splitAddress(offer.address),
    image_paths: offer.image_paths,
  };
}
