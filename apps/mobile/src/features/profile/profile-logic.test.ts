import { describe, expect, it } from 'vitest';

import {
  avatarTint,
  explorerLevel,
  currentCard,
  initials,
  levelProgress,
  levelUpSince,
  redeemedVouchers,
  savedCents,
  stampOrder,
  untilNextLevel,
} from './profile-logic';

describe('initials', () => {
  it('nimmt die Anfangsbuchstaben von Vor- und Nachname', () => {
    expect(initials('Mia', 'müller')).toBe('MM');
    expect(initials('  Tobias ', '')).toBe('T');
    expect(initials('', '')).toBe('?');
  });
});

describe('avatarTint', () => {
  it('liefert für dieselbe Person immer denselben Ton', () => {
    expect(avatarTint('user-1')).toBe(avatarTint('user-1'));
  });
});

const voucher = (offer_id: string, status: string, seats = 1) => ({ offer_id, status, seats });

describe('savedCents', () => {
  const offers = new Map([
    ['a', { original_price_cents: 4000, deal_price_cents: 2400 }],
    ['b', { original_price_cents: 2000, deal_price_cents: 1500 }],
  ]);

  it('zählt nur eingelöste Codes, mal Plätze', () => {
    const vouchers = [
      voucher('a', 'eingeloest', 2),
      voucher('b', 'eingeloest'),
      voucher('b', 'aktiv'),
      voucher('a', 'storniert'),
    ];
    expect(savedCents(vouchers, offers)).toBe(1600 * 2 + 500);
    expect(redeemedVouchers(vouchers)).toHaveLength(2);
  });

  it('überspringt Angebote ohne geladenen Preis', () => {
    expect(savedCents([voucher('fehlt', 'eingeloest')], offers)).toBe(0);
  });
});

describe('explorerLevel', () => {
  it('steigt alle fünf Stempel um eine Stufe', () => {
    expect(explorerLevel(0)).toBe('newbie');
    expect(explorerLevel(4)).toBe('newbie');
    expect(explorerLevel(5)).toBe('explorer');
    expect(explorerLevel(10)).toBe('cityExplorer');
    expect(explorerLevel(15)).toBe('legend');
    expect(explorerLevel(40)).toBe('legend');
  });

  it('nennt, wie viele Stempel bis zur nächsten Stufe fehlen', () => {
    expect(untilNextLevel(0)).toBe(5);
    expect(untilNextLevel(3)).toBe(2);
    expect(untilNextLevel(9)).toBe(1);
    expect(untilNextLevel(15)).toBeNull();
  });

  it('verträgt kaputte Eingaben', () => {
    expect(levelProgress(-2)).toMatchObject({ level: 'newbie', left: 5 });
    expect(levelProgress(6.7)).toMatchObject({ level: 'explorer', left: 4 });
  });
});

describe('levelProgress', () => {
  it('nennt die nächste Stufe mit Emoji', () => {
    expect(levelProgress(7)).toEqual({
      level: 'explorer',
      emoji: '🧭',
      index: 1,
      next: 'cityExplorer',
      nextEmoji: '🏙️',
      left: 3,
    });
    expect(levelProgress(15)).toMatchObject({ next: null, nextEmoji: null, left: null });
  });
});

describe('stampOrder', () => {
  it('nimmt nur eingelöste Codes, ältester zuerst', () => {
    const vouchers = [
      { id: 'c', status: 'eingeloest', offer_id: 'o', redeemed_at: '2026-11-12T10:00:00Z' },
      { id: 'x', status: 'aktiv', offer_id: 'o', redeemed_at: null },
      { id: 'a', status: 'eingeloest', offer_id: 'o', redeemed_at: '2026-11-01T10:00:00Z' },
      { id: 'b', status: 'eingeloest', offer_id: 'o', redeemed_at: '2026-11-05T10:00:00Z' },
    ];
    expect(stampOrder(vouchers).map((voucher) => voucher.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('currentCard', () => {
  const stamps = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

  it('zeigt die Stempel seit der letzten Stufe', () => {
    expect(currentCard(stamps(0))).toEqual({ start: 0, stamps: [] });
    expect(currentCard(stamps(3)).stamps.map((s) => s.number)).toEqual([0, 1, 2]);
    expect(currentCard(stamps(7))).toEqual({
      start: 5,
      stamps: [
        { stamp: 's5', number: 5 },
        { stamp: 's6', number: 6 },
      ],
    });
  });

  it('fängt nach einer vollen Karte leer an', () => {
    expect(currentCard(stamps(5))).toEqual({ start: 5, stamps: [] });
  });

  it('zeigt auf der höchsten Stufe die letzten fünf', () => {
    const card = currentCard(stamps(18));
    expect(card.start).toBe(13);
    expect(card.stamps.map((s) => s.stamp)).toEqual(['s13', 's14', 's15', 's16', 's17']);
  });
});

describe('levelUpSince', () => {
  it('meldet eine neue Stufe nur beim Überschreiten der Grenze', () => {
    expect(levelUpSince(3, 4)).toBeNull();
    expect(levelUpSince(4, 5)?.level).toBe('explorer');
    expect(levelUpSince(3, 11)?.level).toBe('cityExplorer');
    expect(levelUpSince(5, 5)).toBeNull();
    expect(levelUpSince(20, 21)).toBeNull();
  });
});
