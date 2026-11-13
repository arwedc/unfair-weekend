import { describe, expect, it } from 'vitest';

import { getMessages } from '../../lib/i18n/messages';

import {
  authErrorField,
  checkEmailStep,
  checkNameStep,
  previousStep,
  registerProgress,
} from './register-logic';

describe('registerProgress', () => {
  it('zählt die drei Schritte und füllt den Balken anteilig', () => {
    expect(registerProgress('name')).toEqual({ number: 1, total: 3, value: 1 / 3 });
    expect(registerProgress('email')).toEqual({ number: 2, total: 3, value: 2 / 3 });
    expect(registerProgress('interests')).toEqual({ number: 3, total: 3, value: 1 });
  });
});

describe('previousStep', () => {
  it('geht einen Schritt zurück, beim ersten nicht weiter', () => {
    expect(previousStep('interests')).toBe('email');
    expect(previousStep('email')).toBe('name');
    expect(previousStep('name')).toBeNull();
  });
});

describe('checkNameStep', () => {
  it('nimmt Vor- und Nachname getrimmt an', () => {
    expect(checkNameStep('  Mia ', ' Muster  ')).toEqual({
      ok: true,
      firstName: 'Mia',
      lastName: 'Muster',
    });
  });

  it('verlangt beide Namen und meldet den Fehler am Feld', () => {
    const result = checkNameStep(' ', '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.firstName).toBeTruthy();
    expect(result.errors.lastName).toBeTruthy();
  });

  it('meldet nur das fehlende Feld', () => {
    const result = checkNameStep('Mia', '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.firstName).toBeUndefined();
    expect(result.errors.lastName).toBeTruthy();
  });

  it('lehnt zu lange Namen ab (höchstens 50 Zeichen)', () => {
    const result = checkNameStep('M'.repeat(51), 'Muster');
    expect(result.ok).toBe(false);
  });
});

describe('checkEmailStep', () => {
  it('schreibt die E-Mail klein und ohne Leerzeichen', () => {
    expect(checkEmailStep('  Mia@Example.DE ', 'geheim123', 'geheim123')).toEqual({
      ok: true,
      email: 'mia@example.de',
    });
  });

  it('meldet eine ungültige E-Mail am Feld', () => {
    const result = checkEmailStep('mia@', 'geheim123', 'geheim123');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.email).toBeTruthy();
    expect(result.errors.password).toBeUndefined();
  });

  it('verlangt mindestens 8 Zeichen und prüft die Wiederholung erst danach', () => {
    const result = checkEmailStep('mia@example.de', 'kurz', 'anders');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.password).toBeTruthy();
    expect(result.errors.passwordRepeat).toBeUndefined();
  });

  it('meldet abweichende Passwörter in der gewählten Sprache', () => {
    const de = checkEmailStep('mia@example.de', 'geheim123', 'geheim124', 'de');
    const en = checkEmailStep('mia@example.de', 'geheim123', 'geheim124', 'en');
    expect(de).toEqual({
      ok: false,
      errors: { passwordRepeat: getMessages('de').common.auth.passwordMismatch },
    });
    expect(en).toEqual({
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
