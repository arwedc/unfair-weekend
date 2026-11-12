import { describe, expect, it } from 'vitest';
import { isRpcErrorCode, parseRpcError, RPC_ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE } from './errors';

describe('parseRpcError', () => {
  it('liefert null ohne Fehler', () => {
    expect(parseRpcError(null)).toBeNull();
    expect(parseRpcError(undefined)).toBeNull();
  });

  it('erkennt bekannte Codes und nutzt den genaueren Server-Text', () => {
    expect(
      parseRpcError({
        code: 'P0001',
        message: 'AUSGEBUCHT',
        details: 'Es sind nur noch 2 Plätze frei.',
      }),
    ).toEqual({
      code: 'AUSGEBUCHT',
      message: 'Es sind nur noch 2 Plätze frei.',
      raw: 'Es sind nur noch 2 Plätze frei.',
    });
  });

  it('fällt auf den Standardtext zurück, wenn der Server keinen eigenen hat', () => {
    expect(
      parseRpcError({ code: 'P0001', message: 'GESPERRT', details: 'GESPERRT' })?.message,
    ).toBe(RPC_ERROR_MESSAGES.GESPERRT);
  });

  it('macht aus unbekannten Fehlern UNBEKANNT', () => {
    expect(parseRpcError({ code: '42501', message: 'permission denied for table offers' })).toEqual(
      {
        code: 'UNBEKANNT',
        message: UNKNOWN_ERROR_MESSAGE,
        raw: 'permission denied for table offers',
      },
    );
  });
});

describe('isRpcErrorCode', () => {
  it('prüft gegen die feste Liste', () => {
    expect(isRpcErrorCode('FRIST_ABGELAUFEN')).toBe(true);
    expect(isRpcErrorCode('toString')).toBe(false);
    expect(isRpcErrorCode(42)).toBe(false);
  });
});
