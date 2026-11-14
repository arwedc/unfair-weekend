import { describe, expect, it } from 'vitest';

import {
  avatarStoragePath,
  avatarTint,
  explorerLevel,
  initials,
  LEVEL_STEPS,
  levelProgress,
  redeemedVouchers,
  savedCents,
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
  it('steigt mit den Erlebnissen', () => {
    expect(explorerLevel(0)).toBe('newbie');
    expect(explorerLevel(1)).toBe('explorer');
    expect(explorerLevel(5)).toBe('cityExplorer');
    expect(explorerLevel(15)).toBe('legend');
  });

  it('nennt, wie viel bis zur nächsten Stufe fehlt', () => {
    expect(untilNextLevel(0)).toBe(1);
    expect(untilNextLevel(3)).toBe(2);
    expect(untilNextLevel(7)).toBe(8);
    expect(untilNextLevel(20)).toBeNull();
  });
});

describe('levelProgress', () => {
  it('misst den Weg innerhalb der aktuellen Stufe', () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(1)).toBe(0);
    expect(levelProgress(3)).toBe(0.5);
    expect(levelProgress(10)).toBe(0.5);
  });

  it('ist auf der höchsten Stufe voll', () => {
    expect(levelProgress(15)).toBe(1);
    expect(levelProgress(40)).toBe(1);
  });

  it('Stufen sind aufsteigend sortiert', () => {
    const froms = LEVEL_STEPS.map((step) => step.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
  });
});

describe('avatarStoragePath', () => {
  it('liegt im eigenen Ordner und endet auf .jpg', () => {
    expect(avatarStoragePath('user-1', 'abc')).toBe('user-1/abc.jpg');
  });
});
