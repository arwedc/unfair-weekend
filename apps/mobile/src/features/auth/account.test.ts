import { describe, expect, it } from 'vitest';

import { otpVerifySchema } from '@repo/shared';

import {
  blockedNotice,
  cleanEmailCode,
  firstIssueMessage,
  fullName,
  parseAccount,
  sessionTokensFromUrl,
  splitName,
  supabaseSafeRedirectUrl,
} from './account';

const raw = {
  user_id: 'u1',
  role: 'nutzer',
  age: 29,
  interests: ['kochen_essen'],
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
      age: 29,
      interests: ['kochen_essen'],
      firstName: 'Mia',
      lastName: 'Muster',
      profileComplete: true,
      noShowCount: 1,
      blockedUntil: null,
      isBlocked: false,
      avatarPath: null,
    });
  });

  it('liest das Profilbild, wenn eins gesetzt ist', () => {
    expect(parseAccount({ ...raw, avatar_path: 'u1/bild.jpg' })?.avatarPath).toBe('u1/bild.jpg');
    expect(parseAccount({ ...raw, avatar_path: '' })?.avatarPath).toBeNull();
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

describe('supabaseSafeRedirectUrl', () => {
  const safe = (url: string) => supabaseSafeRedirectUrl(url, 'unfairweekend', 'auth/callback');

  it('nimmt das App-Schema, wenn Expo Go eine WLAN-IP liefert', () => {
    expect(safe('exp://10.10.58.170:8082/--/auth/callback')).toBe('unfairweekend://auth/callback');
    expect(safe('exp://192.168.178.20:8081/--/auth/callback')).toBe(
      'unfairweekend://auth/callback',
    );
    expect(safe('exp://[fe80::1]:8081/--/auth/callback')).toBe('unfairweekend://auth/callback');
  });

  it('lässt Adressen mit Hostnamen unverändert (Tunnel, eigene Builds)', () => {
    expect(safe('exp://abc-anonymous-8081.exp.direct/--/auth/callback')).toBe(
      'exp://abc-anonymous-8081.exp.direct/--/auth/callback',
    );
    expect(safe('unfairweekend://auth/callback')).toBe('unfairweekend://auth/callback');
  });

  it('lässt Loopback unverändert, das erlaubt Supabase (Simulator)', () => {
    expect(safe('exp://127.0.0.1:8081/--/auth/callback')).toBe(
      'exp://127.0.0.1:8081/--/auth/callback',
    );
    expect(safe('exp://[::1]:8081/--/auth/callback')).toBe('exp://[::1]:8081/--/auth/callback');
  });
});

describe('Code aus der E-Mail', () => {
  it('entfernt Leerzeichen und Zeilenumbrüche aus eingefügten Codes', () => {
    expect(cleanEmailCode(' 123 456\n')).toBe('123456');
    expect(cleanEmailCode('12345678')).toBe('12345678');
  });

  it('passt nach dem Säubern zum Schema aus @repo/shared', () => {
    const ok = otpVerifySchema.safeParse({
      email: 'mia@example.com',
      token: cleanEmailCode('123 456'),
    });
    expect(ok.success).toBe(true);
  });

  it('zeigt die erste Meldung übersetzt, sonst den Ersatztext', () => {
    const bad = otpVerifySchema.safeParse({ email: 'mia@example.com', token: 'abc' });
    expect(bad.success).toBe(false);
    if (bad.success) return;
    expect(firstIssueMessage(bad.error, 'de', 'Ersatz')).toBe(
      'Bitte gib den Code aus der E-Mail ein.',
    );
    expect(firstIssueMessage({ issues: [] }, 'de', 'Ersatz')).toBe('Ersatz');
  });
});
