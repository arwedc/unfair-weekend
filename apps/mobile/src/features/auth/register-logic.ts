/**
 * Registrierung in drei Schritten: Name und E-Mail, Passwort, Interessen (freiwillig).
 * Reine Logik ohne React, damit sie sich testen lässt. Die Wahrheit liegt im Server.
 */
import { emailSchema, passwordSchema, profileSchema } from '@repo/shared';
import { DEFAULT_LOCALE, translateValidationMessage, type Locale } from '@repo/shared/i18n';

import { getMessages } from '../../lib/i18n/messages';

export const REGISTER_STEPS = ['person', 'password', 'interests'] as const;
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

export interface PersonErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export type PersonStepResult =
  | { ok: true; firstName: string; lastName: string; email: string }
  | { ok: false; errors: PersonErrors };

/**
 * Schritt 1: Vor- und Nachname (Pflicht, getrimmt, je 1–50 Zeichen wie `update_my_profile`)
 * und E-Mail (klein geschrieben, ohne Leerzeichen).
 */
export function checkPersonStep(
  firstName: string,
  lastName: string,
  email: string,
  locale: Locale = DEFAULT_LOCALE,
): PersonStepResult {
  const errors: PersonErrors = {};

  const name = profileSchema.safeParse({ first_name: firstName, last_name: lastName });
  if (!name.success) {
    for (const issue of name.error.issues) {
      const message = translateValidationMessage(issue.message, locale);
      if (issue.path[0] === 'first_name') errors.firstName ??= message;
      if (issue.path[0] === 'last_name') errors.lastName ??= message;
    }
  }

  const normalizedEmail = email.trim().toLowerCase();
  const parsedEmail = emailSchema.safeParse(normalizedEmail);
  if (!parsedEmail.success) errors.email = firstMessage(parsedEmail.error.issues, locale);

  if (!name.success || errors.email) return { ok: false, errors };
  return {
    ok: true,
    firstName: name.data.first_name,
    lastName: name.data.last_name,
    email: normalizedEmail,
  };
}

/**
 * Passwortregeln der App (mittlere Stufe). Entspricht in Supabase Auth
 * `minimum_password_length = 8` und `password_requirements = "lower_upper_letters_digits"`.
 */
export const PASSWORD_RULES = ['length', 'case', 'digit'] as const;
export type PasswordRule = (typeof PASSWORD_RULES)[number];
export const PASSWORD_MIN_LENGTH = 8;

/** Welche Regeln das Passwort schon erfüllt, z. B. für die Liste mit Haken unter dem Feld. */
export function passwordRules(password: string): Record<PasswordRule, boolean> {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    case: /[a-z]/.test(password) && /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
  };
}

export interface PasswordErrors {
  password?: string;
  passwordRepeat?: string;
}

export type PasswordStepResult = { ok: true } | { ok: false; errors: PasswordErrors };

/** Schritt 2: Passwort erfüllt alle Regeln und ist zweimal gleich eingegeben. */
export function checkPasswordStep(
  password: string,
  passwordRepeat: string,
  locale: Locale = DEFAULT_LOCALE,
): PasswordStepResult {
  const m = getMessages(locale).common.auth;
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return { ok: false, errors: { password: firstMessage(parsed.error.issues, locale) } };
  }
  const rules = passwordRules(password);
  if (!PASSWORD_RULES.every((rule) => rules[rule])) {
    return { ok: false, errors: { password: m.passwordRulesMissing } };
  }
  if (password !== passwordRepeat) {
    return { ok: false, errors: { passwordRepeat: m.passwordMismatch } };
  }
  return { ok: true };
}

/**
 * Zu welchem Feld ein Fehler von Supabase Auth gehört. Die App springt dann zurück zum
 * passenden Schritt und zeigt ihn dort am Feld. Null: Fehler bleibt beim letzten Schritt.
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
