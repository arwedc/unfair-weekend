import { describe, expect, it } from 'vitest';

import {
  cancelHint,
  maxSelectableSeats,
  pastSummary,
  seatsText,
  splitVouchers,
  voucherQrValue,
  voucherStatusInfo,
  voucherWhenText,
} from './voucher-logic';

// Mittwoch, 11.11.2026, 12:00 Uhr in Berlin
const NOW = '2026-11-11T11:00:00Z';

describe('voucherStatusInfo', () => {
  it('zeigt aktive Codes grün', () => {
    expect(voucherStatusInfo({ status: 'aktiv', offer_status: 'aktiv' })).toEqual({
      label: 'Aktiv',
      tone: 'success',
    });
  });

  it('unterscheidet eigene Stornierung von einer Absage', () => {
    expect(voucherStatusInfo({ status: 'storniert', offer_status: 'aktiv' }).label).toBe(
      'Storniert',
    );
    expect(voucherStatusInfo({ status: 'storniert', offer_status: 'abgesagt' })).toEqual({
      label: 'Abgesagt',
      tone: 'warning',
    });
  });

  it('markiert No-Shows als Fehler', () => {
    expect(voucherStatusInfo({ status: 'no_show', offer_status: 'aktiv' }).tone).toBe('error');
  });
});

describe('splitVouchers', () => {
  it('trennt aktive von vergangenen Codes und behält die Reihenfolge', () => {
    const result = splitVouchers([
      { id: 'a', status: 'aktiv' as const },
      { id: 'b', status: 'eingeloest' as const },
      { id: 'c', status: 'aktiv' as const },
      { id: 'd', status: 'no_show' as const },
    ]);
    expect(result.active.map((voucher) => voucher.id)).toEqual(['a', 'c']);
    expect(result.past.map((voucher) => voucher.id)).toEqual(['b', 'd']);
  });
});

describe('voucherWhenText', () => {
  it('nennt beim Einzeltermin Tag und Uhrzeit', () => {
    const text = voucherWhenText(
      {
        offer_type: 'einzeltermin',
        starts_at: '2026-11-12T17:00:00Z',
        ends_at: '2026-11-12T20:00:00Z',
      },
      NOW,
    );
    expect(text).toBe('Morgen, 18:00–21:00');
  });

  it('nennt beim laufenden Zeitraum das Ende', () => {
    const text = voucherWhenText(
      {
        offer_type: 'zeitraum',
        starts_at: '2026-11-10T08:00:00Z',
        ends_at: '2026-11-14T20:00:00Z',
      },
      NOW,
    );
    expect(text).toBe('Einlösbar bis Sa., 14.11.');
  });
});

describe('cancelHint', () => {
  it('nennt die Frist beim Einzeltermin', () => {
    const hint = cancelHint(
      {
        status: 'aktiv',
        can_cancel: true,
        cancel_deadline: '2026-11-12T14:00:00Z',
        offer_type: 'einzeltermin',
      },
      NOW,
    );
    expect(hint).toBe('Kostenlos stornierbar bis morgen, 15:00 Uhr.');
  });

  it('erklärt, wenn die Frist vorbei ist', () => {
    const hint = cancelHint(
      {
        status: 'aktiv',
        can_cancel: false,
        cancel_deadline: '2026-11-11T08:00:00Z',
        offer_type: 'einzeltermin',
      },
      NOW,
    );
    expect(hint).toBe('Die Stornofrist ist seit heute, 09:00 Uhr vorbei.');
  });

  it('erlaubt beim Zeitraum jederzeit', () => {
    const hint = cancelHint(
      {
        status: 'aktiv',
        can_cancel: true,
        cancel_deadline: '2026-11-14T20:00:00Z',
        offer_type: 'zeitraum',
      },
      NOW,
    );
    expect(hint).toContain('solange du den Code nicht eingelöst hast');
  });

  it('ist null für vergangene Codes', () => {
    expect(
      cancelHint(
        {
          status: 'eingeloest',
          can_cancel: false,
          cancel_deadline: '',
          offer_type: 'einzeltermin',
        },
        NOW,
      ),
    ).toBeNull();
  });
});

describe('pastSummary', () => {
  it('beschreibt, was passiert ist', () => {
    expect(
      pastSummary(
        {
          status: 'eingeloest',
          offer_status: 'aktiv',
          redeemed_at: '2026-11-10T18:00:00Z',
          cancelled_at: '',
        },
        NOW,
      ),
    ).toBe('Eingelöst am gestern');
    expect(
      pastSummary(
        { status: 'storniert', offer_status: 'abgesagt', redeemed_at: '', cancelled_at: '' },
        NOW,
      ),
    ).toBe('Der Anbieter hat das Angebot abgesagt.');
    expect(
      pastSummary(
        { status: 'no_show', offer_status: 'aktiv', redeemed_at: '', cancelled_at: '' },
        NOW,
      ),
    ).toBe('Du bist nicht erschienen.');
  });
});

describe('seatsText und maxSelectableSeats', () => {
  it('bildet Einzahl und Mehrzahl', () => {
    expect(seatsText(1)).toBe('1 Platz');
    expect(seatsText(3)).toBe('3 Plätze');
  });

  it('begrenzt auf freie Plätze und das Maximum pro Person', () => {
    expect(maxSelectableSeats({ max_per_user: 4, free_seats: 2 })).toBe(2);
    expect(maxSelectableSeats({ max_per_user: 2, free_seats: 9 })).toBe(2);
    expect(maxSelectableSeats({ max_per_user: 2, free_seats: 0 })).toBe(0);
  });
});

describe('voucherQrValue', () => {
  const TOKEN = 'p9ySM_9f21StzFLKzoQwne-6bk1Qm-ozjh7xL6isYH0';

  it('baut einen Link auf die Einlöse-Seite', () => {
    expect(voucherQrValue(TOKEN, 'https://partner.example.com')).toBe(
      `https://partner.example.com/einloesen/${TOKEN}`,
    );
  });

  it('verträgt einen Slash am Ende der Adresse', () => {
    expect(voucherQrValue(TOKEN, 'http://192.168.1.20:3000/')).toBe(
      `http://192.168.1.20:3000/einloesen/${TOKEN}`,
    );
  });

  it('nimmt ohne Website-Adresse nur den Token', () => {
    expect(voucherQrValue(TOKEN, null)).toBe(TOKEN);
  });
});
