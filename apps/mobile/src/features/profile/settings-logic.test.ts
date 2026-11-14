import { describe, expect, it } from 'vitest';

import { locationRowState } from './settings-logic';

describe('locationRowState', () => {
  it('erlaubt: an, Tipp öffnet die Handy-Einstellungen', () => {
    expect(locationRowState('granted')).toMatchObject({ enabled: true, action: 'settings' });
  });

  it('noch offen: aus, die App fragt selbst', () => {
    expect(locationRowState('undetermined')).toMatchObject({ enabled: false, action: 'ask' });
  });

  it('abgelehnt: aus, nur die Handy-Einstellungen helfen', () => {
    expect(locationRowState('denied')).toMatchObject({ enabled: false, action: 'settings' });
  });

  it('Text in der gewählten Sprache', () => {
    expect(locationRowState('granted', 'en').detail).toBe('On: offers near you');
  });
});
