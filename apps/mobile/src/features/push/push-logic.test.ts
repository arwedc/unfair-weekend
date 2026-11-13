import { describe, expect, it } from 'vitest';

import { pushPlatform, pushRowState, pushTargetFromData } from './push-logic';

const ID = '3f2b8c1e-9a4d-4c7b-8e21-5d6f7a8b9c0d';

describe('pushTargetFromData', () => {
  it('öffnet bei /angebot/<id> die Angebotsseite', () => {
    expect(pushTargetFromData({ url: `/angebot/${ID}` })).toEqual({
      pathname: '/angebot/[id]',
      params: { id: ID },
    });
  });

  it('öffnet bei /code/<id> den Code', () => {
    expect(pushTargetFromData({ url: `/code/${ID}`, outboxId: 7 })).toEqual({
      pathname: '/code/[id]',
      params: { id: ID },
    });
  });

  it('ignoriert fremde Pfade, kaputte IDs und fehlende Daten', () => {
    expect(pushTargetFromData({ url: `/profil` })).toBeNull();
    expect(pushTargetFromData({ url: `/angebot/123` })).toBeNull();
    expect(pushTargetFromData({ url: `https://example.com/angebot/${ID}` })).toBeNull();
    expect(pushTargetFromData({ url: `/angebot/${ID}/extra` })).toBeNull();
    expect(pushTargetFromData({ url: 42 })).toBeNull();
    expect(pushTargetFromData({})).toBeNull();
    expect(pushTargetFromData(null)).toBeNull();
    expect(pushTargetFromData('text')).toBeNull();
  });
});

describe('pushPlatform', () => {
  it('kennt iOS und Android, sonst null', () => {
    expect(pushPlatform('ios')).toBe('ios');
    expect(pushPlatform('android')).toBe('android');
    expect(pushPlatform('web')).toBeNull();
  });
});

describe('pushRowState', () => {
  it('erklärt, warum es in Expo Go nicht geht', () => {
    const state = pushRowState('expo-go', 'granted', false);
    expect(state).toMatchObject({ enabled: false, action: 'none' });
    expect(state.detail).toContain('Expo Go');
  });

  it('ohne EAS-Projekt kein Schalter', () => {
    expect(pushRowState('no-project', 'undetermined', false).action).toBe('none');
  });

  it('abgelehnt: führt in die Einstellungen', () => {
    expect(pushRowState('ok', 'denied', false)).toMatchObject({
      enabled: false,
      action: 'settings',
    });
  });

  it('erlaubt und nicht abgemeldet: an', () => {
    expect(pushRowState('ok', 'granted', false)).toMatchObject({ enabled: true, action: 'toggle' });
  });

  it('erlaubt, aber in der App ausgeschaltet: aus', () => {
    expect(pushRowState('ok', 'granted', true)).toMatchObject({ enabled: false, action: 'toggle' });
  });

  it('noch nie gefragt: aus, Schalter fragt nach', () => {
    expect(pushRowState('ok', 'undetermined', false)).toMatchObject({
      enabled: false,
      action: 'toggle',
    });
  });
});
