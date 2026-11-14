/**
 * Das eigene Konto, so wie `get_my_account` es liefert (jsonb).
 * Reine Logik ohne React und ohne Netzwerk, damit sie sich testen lässt.
 */
import { formatDate, OFFER_CATEGORIES, type OfferCategory } from '@repo/shared';
import { DEFAULT_LOCALE, translateValidationMessage, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

export interface Account {
  userId: string;
  role: 'nutzer' | 'standort' | 'admin';
  age: number | null;
  interests: OfferCategory[];
  firstName: string;
  lastName: string;
  /** Vor- und Nachname sind gesetzt. Ohne das gibt es keinen Code (`PROFIL_UNVOLLSTAENDIG`). */
  profileComplete: boolean;
  noShowCount: number;
  /** Ende der Sperre nach zu vielen No-Shows, sonst null. */
  blockedUntil: string | null;
  isBlocked: boolean;
  /** Profilbild im privaten Bucket `avatars` (<user_id>/<datei>), sonst null. */
  avatarPath: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Liest die Antwort von `get_my_account`. Liefert null, wenn sie nicht wie erwartet aussieht. */
export function parseAccount(json: unknown): Account | null {
  if (typeof json !== 'object' || json === null) return null;
  const raw = json as Record<string, unknown>;
  const userId = text(raw.user_id);
  const role = raw.role;
  if (!userId || (role !== 'nutzer' && role !== 'standort' && role !== 'admin')) return null;
  return {
    userId,
    role,
    age: typeof raw.age === 'number' ? raw.age : null,
    interests: Array.isArray(raw.interests)
      ? raw.interests.filter((value): value is OfferCategory =>
          OFFER_CATEGORIES.includes(value as OfferCategory),
        )
      : [],
    firstName: text(raw.first_name),
    lastName: text(raw.last_name),
    profileComplete: raw.profile_complete === true,
    noShowCount: typeof raw.no_show_count === 'number' ? raw.no_show_count : 0,
    blockedUntil: typeof raw.blocked_until === 'string' ? raw.blocked_until : null,
    isBlocked: raw.is_blocked === true,
    avatarPath:
      typeof raw.avatar_path === 'string' && raw.avatar_path !== '' ? raw.avatar_path : null,
  };
}

export function fullName(account: Pick<Account, 'firstName' | 'lastName'>): string {
  return `${account.firstName} ${account.lastName}`.trim();
}

/** Hinweis für gesperrte Nutzer, mit dem Enddatum der Sperre. Sonst null. */
export function blockedNotice(
  account: Pick<Account, 'isBlocked' | 'blockedUntil'>,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (!account.isBlocked) return null;
  const until = account.blockedUntil
    ? formatDate(account.blockedUntil, { withYear: true, locale })
    : null;
  return getMessages(locale).logic.blocked(until);
}

/** Erste Meldung eines fehlgeschlagenen Zod-Checks in der gewählten Sprache. */
export function firstIssueMessage(
  error: { issues: { message: string }[] },
  locale: Locale,
  fallback: string,
): string {
  const message = error.issues[0]?.message;
  return message ? translateValidationMessage(message, locale) : fallback;
}

/** Code aus der E-Mail, so wie man ihn abtippt oder einfügt („123 456“ → „123456“). */
export function cleanEmailCode(input: string): string {
  return input.replace(/\s+/g, '');
}

/** Zerlegt einen vollen Namen (z. B. von Apple) grob in Vor- und Nachname. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] ?? '' };
}

/**
 * Tokens aus der Rücksprung-URL nach dem Browser-Login (Google).
 * Supabase hängt sie als Fragment (#access_token=…) oder Query an.
 */
export function sessionTokensFromUrl(
  url: string,
): { accessToken: string; refreshToken: string } | { error: string } | null {
  const [beforeHash, hash = ''] = url.split('#');
  const query = (beforeHash ?? '').split('?')[1] ?? '';
  const params = new Map<string, string>();
  for (const part of `${query}&${hash}`.split('&')) {
    const [key, value] = part.split('=');
    if (key && value !== undefined) params.set(key, decodeURIComponent(value.replace(/\+/g, ' ')));
  }
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { error };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/**
 * Rücksprungadresse, die Supabase Auth auch annimmt. Supabase lehnt Adressen ab, deren Host
 * eine IP ist (außer 127.0.0.1 und ::1), egal was in „Redirect URLs“ steht, und leitet dann
 * auf die Site URL (localhost) um. Expo Go im WLAN liefert aber genau so eine Adresse
 * (exp://192.168.…:8081/--/auth/callback). Dann nehmen wir das App-Schema
 * (unfairweekend://auth/callback). Auf iOS fängt das Login-Fenster diesen Rücksprung auch
 * in Expo Go selbst ab.
 */
export function supabaseSafeRedirectUrl(linkingUrl: string, scheme: string, path: string): string {
  const authority = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(linkingUrl)?.[1] ?? '';
  const host = authority.replace(/^.*@/, '');
  const ipv6 = /^\[([^\]]*)\]/.exec(host)?.[1];
  const hostname = ipv6 ?? host.replace(/:\d*$/, '');
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isIp = isIpv4 || ipv6 !== undefined;
  const isLoopback = (isIpv4 && hostname.startsWith('127.')) || hostname === '::1';
  if (!isIp || isLoopback) return linkingUrl;
  return `${scheme}://${path.replace(/^\/+/, '')}`;
}

/** Bestätigungscode aus der Query der Supabase-E-Mail-Redirect-URL. */
export function authCodeFromUrl(url: string): string | null {
  const [beforeHash, hash = ''] = url.split('#');
  const query = (beforeHash ?? '').split('?')[1] ?? '';
  for (const part of `${query}&${hash}`.split('&')) {
    const [key, value] = part.split('=');
    if (key === 'code' && value !== undefined) {
      return decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  return null;
}
