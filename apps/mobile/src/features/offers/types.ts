import type { RpcReturns, RpcRow } from '@repo/shared/types';

/** Admin-Einstellungen (aus `get_settings`), z. B. Stornofrist und Sperrdauer. */
export type AppSettings = RpcReturns<'get_settings'>;

/** Angebot im Feed (eine Zeile aus `list_offers`). */
export type Offer = RpcRow<'list_offers'>;

/** Feed-Angebot mit Veröffentlichungszeit (aus `list_offer_created_at`), für „Neu dabei“. */
export type FeedOffer = Offer & { createdAt: string | null };

/** Angebot auf der Detailseite (aus `get_offer`). */
export type OfferDetail = RpcRow<'get_offer'>;

/** Freigeschalteter Standort mit Unternehmensinfo (aus `get_locations_public`). */
export type PublicLocation = RpcRow<'get_locations_public'>;
