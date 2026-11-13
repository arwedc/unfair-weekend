import { describe, expect, it } from 'vitest';

import { getMessages } from '../../lib/i18n/messages';

import {
  authErrorField,
  checkPasswordStep,
  checkPersonStep,
  passwordRules,
  previousStep,
  registerProgress,
} from './register-logic';

describe('registerProgress', () => {
  it('zählt die drei Schritte und füllt den Balken anteilig', () => {
    expect(registerProgress('person')).toEqual({ number: 1, total: 3, value: 1 / 3 });
    expect(registerProgress('password')).toEqual({ number: 2, total: 3, value: 2 / 3 });
    expect(registerProgress('interests')).toEqual({ number: 3, total: 3, value: 1 });
  });
});

describe('previousStep', () => {
  it('geht einen Schritt zurück, beim ersten nicht weiter', () => {
    expect(previousStep('interests')).toBe('password');
    expect(previousStep('password')).toBe('person');
    expect(previousStep('person')).toBeNull();
  });
});

describe('checkPersonStep', () => {
  it('nimmt Namen getrimmt und die E-Mail klein geschrieben an', () => {
    expect(checkPersonStep('  Mia ', ' Muster  ', '  Mia@Example.DE ')).toEqual({
      ok: true,
      firstName: 'Mia',
      lastName: 'Muster',
      email: 'mia@example.de',
    });
  });

  it('meldet alle fehlenden Felder auf einmal', () => {
    const result = checkPersonStep(' ', '', 'mia@');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.firstName).toBeTruthy();
    expect(result.errors.lastName).toBeTruthy();
    expect(result.errors.email).toBeTruthy();
  });

  it('meldet nur das Feld, das fehlt', () => {
    const result = checkPersonStep('Mia', 'Muster', 'keine-mail');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(['email']);
    expect(result.errors.email).toBeTruthy();
  });

  it('lehnt zu lange Namen ab (höchstens 50 Zeichen)', () => {
    expect(checkPersonStep('M'.repeat(51), 'Muster', 'mia@example.de').ok).toBe(false);
  });
});

describe('passwordRules', () => {
  it('prüft Länge, Groß- und Kleinbuchstaben und Zahl einzeln', () => {
    expect(passwordRules('')).toEqual({ length: false, case: false, digit: false });
    expect(passwordRules('abcdefgh')).toEqual({ length: true, case: false, digit: false });
    expect(passwordRules('Abcdefgh')).toEqual({ length: true, case: true, digit: false });
    expect(passwordRules('Abc1')).toEqual({ length: false, case: true, digit: true });
    expect(passwordRules('Sommer2026')).toEqual({ length: true, case: true, digit: true });
  });
});

describe('checkPasswordStep', () => {
  it('nimmt ein Passwort an, das alle Regeln erfüllt und zweimal gleich ist', () => {
    expect(checkPasswordStep('Sommer2026', 'Sommer2026')).toEqual({ ok: true });
  });

  it('meldet ein zu kurzes Passwort am Feld', () => {
    const result = checkPasswordStep('Ab1', 'Ab1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(['password']);
    expect(result.errors.password).toBeTruthy();
  });

  it('verlangt Groß- und Kleinbuchstaben und eine Zahl', () => {
    const passwordRulesMissing = getMessages('de').common.auth.passwordRulesMissing;
    expect(checkPasswordStep('sommer2026', 'sommer2026')).toEqual({
      ok: false,
      errors: { password: passwordRulesMissing },
    });
    expect(checkPasswordStep('SommerSonne', 'SommerSonne')).toEqual({
      ok: false,
      errors: { password: passwordRulesMissing },
    });
  });

  it('meldet abweichende Wiederholung in der gewählten Sprache', () => {
    expect(checkPasswordStep('Sommer2026', 'Sommer2027', 'de')).toEqual({
      ok: false,
      errors: { passwordRepeat: getMessages('de').common.auth.passwordMismatch },
    });
    expect(checkPasswordStep('Sommer2026', 'Sommer2027', 'en')).toEqual({
      ok: false,
      errors: { passwordRepeat: getMessages('en').common.auth.passwordMismatch },
    });
  });
});

describe('authErrorField', () => {
  it('ordnet E-Mail- und Passwortfehler dem Feld zu', () => {
    expect(authErrorField('user_already_exists')).toBe('email');
    expect(authErrorField('email_exists')).toBe('email');
    expect(authErrorField('email_address_invalid')).toBe('email');
    expect(authErrorField('weak_password')).toBe('password');
  });

  it('lässt andere Fehler beim letzten Schritt', () => {
    expect(authErrorField('over_request_rate_limit')).toBeNull();
    expect(authErrorField('OFFLINE')).toBeNull();
  });
});
