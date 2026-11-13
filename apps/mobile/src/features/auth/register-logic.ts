/**
 * Registrierung in drei Schritten: Name, E-Mail mit Passwort, Interessen (freiwillig).
 * Reine Logik ohne React, damit sie sich testen lässt. Die Wahrheit liegt im Server.
 */
import { emailSchema, passwordSchema, profileSchema } from '@repo/shared';
import { DEFAULT_LOCALE, translateValidationMessage, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

export const REGISTER_STEPS = ['name', 'email', 'interests'] as const;
export type RegisterStep = (typeof REGISTER_STEPS)[number];

/** Nummer des Schritts (ab 1), Anzahl der Schritte und Anteil für den Fortschrittsbalken. */
export function registerProgress(step: RegisterStep): {
  number: number;
  total: number;
  value: number;
} {
  const number = REGISTER_STEPS.indexOf(step) + 1;
  const total = REGISTER_STEPS.length;
  return { number, total, value: number / total };
}

/** Der Schritt davor, z. B. für „Zurück“. Null beim ersten Schritt. */
export function previousStep(step: RegisterStep): RegisterStep | null {
  return REGISTER_STEPS[REGISTER_STEPS.indexOf(step) - 1] ?? null;
}

export interface NameErrors {
  firstName?: string;
  lastName?: string;
}

export type NameStepResult =
  { ok: true; firstName: string; lastName: string } | { ok: false; errors: NameErrors };

/** Schritt 1: Vor- und Nachname, beide Pflicht (getrimmt, je 1–50 Zeichen wie `update_my_profile`). */
export function checkNameStep(
  firstName: string,
  lastName: string,
  locale: Locale = DEFAULT_LOCALE,
): NameStepResult {
  const parsed = profileSchema.safeParse({ first_name: firstName, last_name: lastName });
  if (parsed.success) {
    return { ok: true, firstName: parsed.data.first_name, lastName: parsed.data.last_name };
  }
  const errors: NameErrors = {};
  for (const issue of parsed.error.issues) {
    const message = translateValidationMessage(issue.message, locale);
    if (issue.path[0] === 'first_name') errors.firstName ??= message;
    if (issue.path[0] === 'last_name') errors.lastName ??= message;
  }
  return { ok: false, errors };
}

export interface EmailErrors {
  email?: string;
  password?: string;
  passwordRepeat?: string;
}

export type EmailStepResult = { ok: true; email: string } | { ok: false; errors: EmailErrors };

/** Schritt 2: E-Mail (klein geschrieben, ohne Leerzeichen) und Passwort zweimal gleich. */
export function checkEmailStep(
  email: string,
  password: string,
  passwordRepeat: string,
  locale: Locale = DEFAULT_LOCALE,
): EmailStepResult {
  const errors: EmailErrors = {};
  const normalized = email.trim().toLowerCase();

  const parsedEmail = emailSchema.safeParse(normalized);
  if (!parsedEmail.success) {
    errors.email = firstMessage(parsedEmail.error.issues, locale);
  }
  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) {
    errors.password = firstMessage(parsedPassword.error.issues, locale);
  } else if (password !== passwordRepeat) {
    errors.passwordRepeat = getMessages(locale).common.auth.passwordMismatch;
  }

  if (errors.email || errors.password || errors.passwordRepeat) return { ok: false, errors };
  return { ok: true, email: normalized };
}

/**
 * Zu welchem Feld ein Fehler von Supabase Auth gehört. Die App springt dann zurück zum
 * E-Mail-Schritt und zeigt ihn dort am Feld. Null: Fehler bleibt beim letzten Schritt.
 */
export function authErrorField(code: string): 'email' | 'password' | null {
  switch (code) {
    case 'user_already_exists':
    case 'email_exists':
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return 'email';
    case 'weak_password':
      return 'password';
    default:
      return null;
  }
}

function firstMessage(issues: readonly { message: string }[], locale: Locale): string {
  const message = issues[0]?.message ?? '';
  return translateValidationMessage(message, locale);
}
