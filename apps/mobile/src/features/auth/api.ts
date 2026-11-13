/** Anmelden, Profil und Konto. Abläufe nach docs/BACKEND.md, Abschnitt „Rollen und Auth“. */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { forgetDevice, unregisterDevice } from '@/features/push/push';
import { ApiError, toApiError } from '@/lib/api-error';
import { getLocale } from '@/lib/i18n/locale-store';
import { getMessages } from '@/lib/i18n/messages';
import { supabase } from '@/lib/supabase';

import { parseAccount, sessionTokensFromUrl, type Account } from './account';

/** Der Nutzer hat den Login selbst abgebrochen. Dafür zeigen wir keinen Fehler. */
export const CANCELLED = 'ABGEBROCHEN';

/** Texte der Anmeldung in der gewählten Sprache. */
const authText = () => getMessages(getLocale()).common.auth;

function authMessage(code: string): string | undefined {
  const m = authText();
  const map: Record<string, string> = {
    invalid_credentials: m.invalidCredentials,
    otp_expired: m.otpExpired,
    over_email_send_rate_limit: m.rateLimit,
    over_request_rate_limit: m.rateLimit,
    email_address_invalid: m.emailInvalid,
    provider_disabled: m.notSetUp,
    validation_failed: m.notSetUp,
  };
  return map[code];
}

/** Fehler von Supabase Auth in einen verständlichen Text übersetzen (nie den Rohtext zeigen). */
function toAuthError(error: { message?: string; code?: string | null }): ApiError {
  const code = error.code ?? '';
  const known = authMessage(code);
  if (known) return new ApiError(code, known);
  const fallback = toApiError({ message: error.message });
  return fallback.code === 'OFFLINE' ? fallback : new ApiError(code || 'AUTH', authText().failed);
}

export async function fetchAccount(): Promise<Account> {
  const { data, error } = await supabase.rpc('get_my_account');
  if (error) throw toApiError(error);
  const account = parseAccount(data);
  if (!account) throw new ApiError('KEIN_PROFIL', authText().accountLoadFailed);
  return account;
}

export async function updateProfile(firstName: string, lastName: string): Promise<void> {
  const { error } = await supabase.rpc('update_my_profile', {
    p_first_name: firstName,
    p_last_name: lastName,
  });
  if (error) throw toApiError(error);
}

/** Schickt einen Einmal-Code per E-Mail. Legt das Konto an, falls es noch keins gibt. */
export async function requestEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw toAuthError(error);
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw toAuthError(error);
}

/** Nur für Entwicklung: Seed-Konten mit E-Mail und Passwort. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toAuthError(error);
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Sign in with Apple (nur iOS). Apple nennt den Namen nur beim allerersten Login,
 * deshalb geben wir ihn zurück, damit die App das Profil gleich füllen kann.
 */
export async function signInWithApple(): Promise<{ firstName: string; lastName: string }> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ERR_REQUEST_CANCELED') throw new ApiError(CANCELLED, '');
    throw new ApiError('APPLE', authText().appleFailed);
  }
  if (!credential.identityToken) {
    throw new ApiError('APPLE', authText().appleFailed);
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw toAuthError(error);
  return {
    firstName: credential.fullName?.givenName ?? '',
    lastName: credential.fullName?.familyName ?? '',
  };
}

/** Rücksprungadresse nach dem Browser-Login. Muss in Supabase unter „Redirect URLs“ erlaubt sein. */
export function authRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

/** Google-Login über den System-Browser (läuft auch in Expo Go). */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw toAuthError(error);
  if (!data.url) throw new ApiError('GOOGLE', authText().googleFailed);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new ApiError(CANCELLED, '');
  await completeSignInFromUrl(result.url);
}

/**
 * Schließt den Browser-Login ab: liest die Tokens aus der Rücksprung-URL und setzt die Session.
 * Wird auch von der Route /auth/callback genutzt, falls die URL als Deep Link ankommt (Android).
 */
export async function completeSignInFromUrl(url: string): Promise<void> {
  const tokens = sessionTokensFromUrl(url);
  if (!tokens || 'error' in tokens) {
    throw new ApiError('GOOGLE', authText().googleFailed);
  }
  const session = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (session.error) throw toAuthError(session.error);
}

export async function signOut(): Promise<void> {
  // Erst das Gerät für Pushes abmelden, solange die Session noch gilt.
  await unregisterDevice();
  // Auch ohne Netz abmelden: lokal reicht, der Server-Token läuft von selbst ab.
  await supabase.auth.signOut({ scope: 'local' });
}

/** Löscht das Konto endgültig (Pflicht im App Store) und meldet ab. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw toApiError(error);
  // Push-Tokens hat der Server mit dem Konto gelöscht, lokal nur vergessen.
  await forgetDevice();
  await supabase.auth.signOut({ scope: 'local' });
}
