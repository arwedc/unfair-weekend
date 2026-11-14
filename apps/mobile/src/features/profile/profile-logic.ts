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

/** Stufen mit der Zahl eingelöster Erlebnisse, ab der sie gelten (aufsteigend). */
export const LEVEL_STEPS: readonly { level: ExplorerLevel; from: number }[] = [
  { level: 'newbie', from: 0 },
  { level: 'explorer', from: 1 },
  { level: 'cityExplorer', from: 5 },
  { level: 'legend', from: 15 },
];

/** Stufe nach eingelösten Erlebnissen: 0 neu, ab 1 unterwegs, ab 5 Stadtentdecker, ab 15 Legende. */
export function explorerLevel(redeemed: number): ExplorerLevel {
  let current: ExplorerLevel = 'newbie';
  for (const step of LEVEL_STEPS) if (redeemed >= step.from) current = step.level;
  return current;
}

/** Wie viele Erlebnisse noch bis zur nächsten Stufe fehlen (null auf der höchsten). */
export function untilNextLevel(redeemed: number): number | null {
  const next = LEVEL_STEPS.find((step) => step.from > redeemed);
  return next ? next.from - redeemed : null;
}

/** Fortschritt innerhalb der aktuellen Stufe von 0 bis 1 (1 auf der höchsten Stufe). */
export function levelProgress(redeemed: number): number {
  const nextIndex = LEVEL_STEPS.findIndex((step) => step.from > redeemed);
  if (nextIndex === -1) return 1;
  const start = LEVEL_STEPS[nextIndex - 1]?.from ?? 0;
  const end = LEVEL_STEPS[nextIndex]?.from ?? start + 1;
  return Math.min(1, Math.max(0, (redeemed - start) / (end - start)));
}

/**
 * Speicherort eines neuen Profilbilds im Bucket `avatars`: immer im eigenen Ordner
 * und mit neuem Namen, damit kein altes Bild aus dem Cache auftaucht.
 */
export function avatarStoragePath(userId: string, fileId: string): string {
  return `${userId}/${fileId}.jpg`;
}
