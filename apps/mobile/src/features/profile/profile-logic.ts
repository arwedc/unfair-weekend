/**
 * Reine Logik für das Profil: Initialen, Bilanz (gespart, erlebt) und Entdecker-Stufe.
 * Ohne React und ohne Netzwerk, damit sie sich testen lässt.
 */
import type { FunTint } from '../../theme';

/** Initialen für den runden Avatar: „Mia Müller“ → „MM“, nur Vorname → „M“. */
export function initials(firstName: string, lastName: string): string {
  const letters = [firstName, lastName]
    .map((part) => part.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join('');
  return letters || '?';
}

const AVATAR_TINTS: readonly FunTint[] = ['peach', 'mint', 'lilac', 'sky', 'pink', 'lemon'];

/** Fester bunter Ton pro Person, damit der Avatar nicht bei jedem Öffnen wechselt. */
export function avatarTint(seed: string): FunTint {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length] ?? 'lemon';
}

interface RedeemedVoucher {
  status: string;
  seats: number;
  offer_id: string;
}

interface PricedOffer {
  original_price_cents: number;
  deal_price_cents: number;
}

/** Eingelöste Codes, nur die zählen für die Bilanz. */
export function redeemedVouchers<T extends RedeemedVoucher>(vouchers: readonly T[]): T[] {
  return vouchers.filter((voucher) => voucher.status === 'eingeloest');
}

/**
 * Gesparter Betrag über alle eingelösten Codes: (alter Preis − Deal-Preis) × Plätze.
 * Angebote, deren Preis gerade nicht geladen ist, zählen nicht mit.
 */
export function savedCents(
  vouchers: readonly RedeemedVoucher[],
  offers: ReadonlyMap<string, PricedOffer>,
): number {
  return redeemedVouchers(vouchers).reduce((sum, voucher) => {
    const offer = offers.get(voucher.offer_id);
    if (!offer) return sum;
    const perSeat = Math.max(0, offer.original_price_cents - offer.deal_price_cents);
    return sum + perSeat * voucher.seats;
  }, 0);
}

export type ExplorerLevel = 'newbie' | 'explorer' | 'cityExplorer' | 'legend';

/** Stufe nach eingelösten Erlebnissen: 0 neu, ab 1 unterwegs, ab 5 Stadtentdecker, ab 15 Legende. */
export function explorerLevel(redeemed: number): ExplorerLevel {
  if (redeemed >= 15) return 'legend';
  if (redeemed >= 5) return 'cityExplorer';
  if (redeemed >= 1) return 'explorer';
  return 'newbie';
}

/** Wie viele Erlebnisse noch bis zur nächsten Stufe fehlen (null auf der höchsten). */
export function untilNextLevel(redeemed: number): number | null {
  if (redeemed >= 15) return null;
  if (redeemed >= 5) return 15 - redeemed;
  if (redeemed >= 1) return 5 - redeemed;
  return 1;
}
