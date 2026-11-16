import type { RpcReturns, RpcRow } from '@repo/shared/types';

/** Admin-Einstellungen (aus `get_settings`), z. B. Stornofrist und Sperrdauer. */
export type AppSettings = RpcReturns<'get_settings'>;

/** Angebot im Feed (eine Zeile aus `list_offers`). */
export type Offer = RpcRow<'list_offers'>;

/** Bewertung eines Anbieters: Schnitt (eine Nachkommastelle) und Anzahl sichtbarer Bewertungen. */
export interface LocationRatingSummary {
  average: number;
  count: number;
}

/**
 * Feed-Angebot (aus `list_offers_v2`): mit Veröffentlichungszeit für „Neu dabei“ und der
 * Bewertung des Anbieters. `locationRating` fehlt, solange der Anbieter keine Bewertung hat.
 */
export type FeedOffer = Offer & {
  createdAt: string | null;
  locationRating?: LocationRatingSummary;
};

/** Angebot auf der Detailseite (aus `get_offer`). */
export type OfferDetail = RpcRow<'get_offer'>;

/** Freigeschalteter Standort mit Unternehmensinfo und Galerie (öffentlicher Standort-RPC). */
export type PublicLocation = RpcRow<'get_locations_public_with_images'>;
