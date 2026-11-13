import { describe, expect, it } from 'vitest';

import { blockedNotice, fullName, parseAccount, sessionTokensFromUrl, splitName } from './account';

const raw = {
  user_id: 'u1',
  role: 'nutzer',
  first_name: 'Mia',
  last_name: 'Muster',
  profile_complete: true,
  no_show_count: 1,
  blocked_until: null,
  is_blocked: false,
  location: null,
};

describe('parseAccount', () => {
  it('liest ein vollständiges Konto', () => {
    expect(parseAccount(raw)).toEqual({
      userId: 'u1',
      role: 'nutzer',
      firstName: 'Mia',
      lastName: 'Muster',
      profileComplete: true,
      noShowCount: 1,
      blockedUntil: null,
      isBlocked: false,
    });
  });

  it('behandelt fehlende Namen als leer und unvollständig', () => {
    const account = parseAccount({
      ...raw,
      first_name: null,
      last_name: null,
      profile_complete: false,
    });
    expect(account?.firstName).toBe('');
    expect(account?.profileComplete).toBe(false);
  });

  it('verwirft Unbrauchbares', () => {
    expect(parseAccount(null)).toBeNull();
    expect(parseAccount('x')).toBeNull();
    expect(parseAccount({ ...raw, role: 'chef' })).toBeNull();
    expect(parseAccount({ ...raw, user_id: undefined })).toBeNull();
  });
});

describe('fullName', () => {
  it('fügt Vor- und Nachname zusammen', () => {
    expect(fullName({ firstName: 'Mia', lastName: 'Muster' })).toBe('Mia Muster');
    expect(fullName({ firstName: 'Mia', lastName: '' })).toBe('Mia');
  });
});

describe('blockedNotice', () => {
  it('ist null ohne Sperre', () => {
    expect(blockedNotice({ isBlocked: false, blockedUntil: null })).toBeNull();
  });

  it('nennt das Enddatum der Sperre', () => {
    const notice = blockedNotice({ isBlocked: true, blockedUntil: '2026-12-01T10:00:00Z' });
    expect(notice).toContain('01.12.2026');
  });
});

describe('splitName', () => {
  it('trennt den letzten Teil als Nachnamen ab', () => {
    expect(splitName('Mia Sophie Muster')).toEqual({ firstName: 'Mia Sophie', lastName: 'Muster' });
    expect(splitName('Mia')).toEqual({ firstName: 'Mia', lastName: '' });
    expect(splitName('  ')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('sessionTokensFromUrl', () => {
  it('liest Tokens aus dem Fragment', () => {
    expect(
      sessionTokensFromUrl('unfairweekend://auth/callback#access_token=a.b&refresh_token=r1&x=1'),
    ).toEqual({ accessToken: 'a.b', refreshToken: 'r1' });
  });

  it('liest Tokens aus der Query', () => {
    expect(
      sessionTokensFromUrl('exp://1.2.3.4:8081/--/auth/callback?access_token=a&refresh_token=r'),
    ).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('gibt Fehler des Anbieters weiter', () => {
    expect(
      sessionTokensFromUrl('unfairweekend://auth/callback#error_description=Zugriff+verweigert'),
    ).toEqual({
      error: 'Zugriff verweigert',
    });
  });

  it('ist null ohne Tokens', () => {
    expect(sessionTokensFromUrl('unfairweekend://auth/callback')).toBeNull();
  });
});
