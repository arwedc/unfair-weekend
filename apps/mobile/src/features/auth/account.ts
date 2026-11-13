/**
 * Das eigene Konto, so wie `get_my_account` es liefert (jsonb).
 * Reine Logik ohne React und ohne Netzwerk, damit sie sich testen lässt.
 */
import { formatDate, OFFER_CATEGORIES, type OfferCategory } from '@repo/shared';
import { DEFAULT_LOCALE, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

export interface Account {
  userId: string;
  role: 'nutzer' | 'standort' | 'admin';
  username: string | null;
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
    username: typeof raw.username === 'string' ? raw.username : null,
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
