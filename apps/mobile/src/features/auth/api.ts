/** Anmelden, Profil und Konto. Abläufe nach docs/BACKEND.md, Abschnitt „Rollen und Auth“. */
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { UserSignUpInput } from '@repo/shared';

import { forgetDevice, unregisterDevice } from '@/features/push/push';
import { ApiError, toApiError } from '@/lib/api-error';
import { getLocale } from '@/lib/i18n/locale-store';
import { getMessages } from '@/lib/i18n/messages';
import { supabase } from '@/lib/supabase';

import {
  authCodeFromUrl,
  parseAccount,
  sessionTokensFromUrl,
  supabaseSafeRedirectUrl,
  type Account,
} from './account';

/** Der Nutzer hat den Login selbst abgebrochen. Dafür zeigen wir keinen Fehler. */
export const CANCELLED = 'ABGEBROCHEN';

/** Texte der Anmeldung in der gewählten Sprache. */
const authText = () => getMessages(getLocale()).common.auth;

function authMessage(code: string): string | undefined {
  const m = authText();
  const map: Record<string, string> = {
    invalid_credentials: m.invalidCredentials,
    email_not_confirmed: m.emailNotConfirmed,
    weak_password: m.weakPassword,
    same_password: m.samePassword,
    user_already_exists: m.userExists,
    email_exists: m.userExists,
    email_address_not_authorized: m.emailNotAuthorized,
    otp_expired: m.otpExpired,
    over_email_send_rate_limit: m.confirmRateLimit,
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

/** Anmeldung mit E-Mail und Passwort (auch für die Seed-Konten in der Entwicklung). */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toAuthError(error);
}

/**
 * Registriert einen Nutzer per E-Mail und Passwort. Gibt zurück, ob direkt eine Session besteht.
 * Vor- und Nachname übernimmt der Trigger `handle_new_user` aus den Metadaten ins Profil.
 */
export async function signUpWithEmail(
  input: UserSignUpInput,
  name?: { firstName: string; lastName: string },
): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        ...(name ? { first_name: name.firstName, last_name: name.lastName } : {}),
        ...(input.age !== undefined ? { age: input.age } : {}),
        interests: input.interests,
      },
      emailRedirectTo: authRedirectUrl(),
    },
  });
  if (error) throw toAuthError(error);
  // Bei „Confirm email“ meldet Supabase ein bestehendes Konto nicht als Fehler, sondern liefert
  // einen Platzhalter-Nutzer ohne Identitäten. Ohne Bestätigung kommt direkt `user_already_exists`.
  if (data.user?.identities?.length === 0) throw toAuthError({ code: 'user_already_exists' });
  return data.session !== null;
}

/** Bestätigt die Registrierung mit dem Code aus der E-Mail. Danach ist der Nutzer angemeldet. */
export async function confirmSignUpWithCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
  if (error) throw toAuthError(error);
}

/** Schickt die Bestätigungs-E-Mail der Registrierung nochmal. */
export async function resendSignUpConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw toAuthError(error);
}

/**
 * Schickt einen Code zum Zurücksetzen des Passworts (Vorlage „Reset Password“ mit `{{ .Token }}`).
 * Supabase verrät dabei nicht, ob es das Konto gibt.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw toAuthError(error);
}

/** Prüft den Code zum Zurücksetzen. Danach ist der Nutzer angemeldet und darf ein neues Passwort setzen. */
export async function verifyPasswordResetCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (error) throw toAuthError(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
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

/** Schema der App aus app.json (`scheme`). */
const APP_SCHEME = (() => {
  const scheme = Constants.expoConfig?.scheme;
  return (Array.isArray(scheme) ? scheme[0] : scheme) ?? 'unfairweekend';
})();

/**
 * Rücksprungadresse nach dem Browser-Login. Muss in Supabase unter „Redirect URLs“ erlaubt sein
 * (`exp://**`, `unfairweekend://**`). In Expo Go im WLAN wird daraus das App-Schema, weil
 * Supabase Adressen mit IP ablehnt (siehe `supabaseSafeRedirectUrl`).
 */
export function authRedirectUrl(): string {
  const path = 'auth/callback';
  return supabaseSafeRedirectUrl(Linking.createURL(path), APP_SCHEME, path);
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
 * Schließt OAuth oder E-Mail-Bestätigung ab und setzt die Session aus der Rücksprung-URL.
 * Wird auch von der Route /auth/callback genutzt, falls die URL als Deep Link ankommt.
 */
export async function completeSignInFromUrl(url: string): Promise<void> {
  const code = authCodeFromUrl(url);
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw toAuthError(error);
    return;
  }

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
