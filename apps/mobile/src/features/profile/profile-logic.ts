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

/** Eine Stempelkarte hat 5 Felder. Ist sie voll, kommt die nächste Stufe und eine neue Karte. */
export const STAMPS_PER_CARD = 5;

/**
 * Stufen in Reihenfolge: ab wie vielen Stempeln (eingelösten Erlebnissen) sie gelten und
 * ihr Emoji. Das Emoji ist sprachunabhängig, die Namen kommen aus den Texten (`profile.levels`).
 */
export const EXPLORER_LEVELS = [
  { key: 'newbie', from: 0, emoji: '🌱' },
  { key: 'explorer', from: STAMPS_PER_CARD, emoji: '🧭' },
  { key: 'cityExplorer', from: 2 * STAMPS_PER_CARD, emoji: '🏙️' },
  { key: 'legend', from: 3 * STAMPS_PER_CARD, emoji: '🏆' },
] as const satisfies readonly { key: ExplorerLevel; from: number; emoji: string }[];

export interface LevelProgress {
  level: ExplorerLevel;
  emoji: string;
  /** Position in `EXPLORER_LEVELS`, also Stufe 1 = 0. */
  index: number;
  /** Nächste Stufe, null auf der höchsten. */
  next: ExplorerLevel | null;
  nextEmoji: string | null;
  /** Wie viele Stempel bis zur nächsten Stufe fehlen, null auf der höchsten. */
  left: number | null;
}

/** Stufe und nächste Stufe nach Zahl der Stempel. */
export function levelProgress(stamps: number): LevelProgress {
  const count = Math.max(0, Math.floor(stamps));
  let index = 0;
  EXPLORER_LEVELS.forEach((level, i) => {
    if (count >= level.from) index = i;
  });
  const current = EXPLORER_LEVELS[index] ?? EXPLORER_LEVELS[0];
  const next = EXPLORER_LEVELS[index + 1];
  return {
    level: current.key,
    emoji: current.emoji,
    index,
    next: next?.key ?? null,
    nextEmoji: next?.emoji ?? null,
    left: next ? next.from - count : null,
  };
}

/** Stufe nach Stempeln: 0 neu, ab 5 unterwegs, ab 10 Stadtentdecker, ab 15 Legende. */
export function explorerLevel(stamps: number): ExplorerLevel {
  return levelProgress(stamps).level;
}

/** Wie viele Stempel noch bis zur nächsten Stufe fehlen (null auf der höchsten). */
export function untilNextLevel(stamps: number): number | null {
  return levelProgress(stamps).left;
}

interface StampVoucher {
  id: string;
  status: string;
  offer_id: string;
  redeemed_at: string | null;
}

/** Eingelöste Codes in der Reihenfolge, in der sie eingelöst wurden (ältester zuerst). */
export function stampOrder<T extends StampVoucher>(vouchers: readonly T[]): T[] {
  return vouchers
    .filter((voucher) => voucher.status === 'eingeloest')
    .sort((a, b) => (a.redeemed_at ?? '9999').localeCompare(b.redeemed_at ?? '9999'));
}

export interface StampCard<T> {
  /** Stempel auf der aktuellen Karte, mit ihrer Nummer über alle Karten (0 = erster Stempel). */
  stamps: { stamp: T; number: number }[];
  /** Erste Stempelnummer dieser Karte. */
  start: number;
}

/**
 * Die aktuelle Karte: die Stempel seit der letzten Stufe. Auf der höchsten Stufe gibt es
 * keine neue Karte mehr, dort zeigt sie die letzten fünf Stempel (also immer voll).
 */
export function currentCard<T>(stamps: readonly T[]): StampCard<T> {
  const level = levelProgress(stamps.length);
  const start =
    level.next === null
      ? Math.max(0, stamps.length - STAMPS_PER_CARD)
      : (EXPLORER_LEVELS[level.index]?.from ?? 0);
  return {
    start,
    stamps: stamps.slice(start).map((stamp, offset) => ({ stamp, number: start + offset })),
  };
}

/**
 * Neue Stufe seit dem letzten Besuch? Gibt die erreichte Stufe zurück, sonst null.
 * `seen` ist die Zahl der Stempel, die die Person schon gesehen hat.
 */
export function levelUpSince(seen: number, now: number): LevelProgress | null {
  const before = levelProgress(seen);
  const after = levelProgress(now);
  return after.index > before.index ? after : null;
}

/**
 * Speicherort eines neuen Profilbilds im Bucket `avatars`: immer im eigenen Ordner
 * und mit neuem Namen, damit kein altes Bild aus dem Cache auftaucht.
 */
export function avatarStoragePath(userId: string, fileId: string): string {
  return `${userId}/${fileId}.jpg`;
}
