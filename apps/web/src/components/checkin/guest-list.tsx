'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import type { Enums } from '@repo/shared';
import {
  markNoShowAction,
  redeemCodeAction,
  type NoShowState,
  type RedeemState,
} from '@/app/(portal)/einloesen/actions';
import { Button, Card } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { VoucherStatusBadge } from './voucher-status-badge';

export interface Guest {
  voucherId: string;
  shortCode: string;
  seats: number;
  status: Enums<'voucher_status'>;
  isPaid: boolean;
  name: string;
  /** Fertig formatierte Einlösezeit (Europe/Berlin), falls eingelöst. */
  redeemedLabel: string | null;
}

interface GuestListProps {
  offerId: string;
  guests: Guest[];
  /** Angebot nicht mehr aktiv: nur anzeigen, keine Buttons. */
  readOnly: boolean;
  /** Einzeltermin hat begonnen: „Nicht erschienen“ anbieten (Frist prüft der Server). */
  canMarkNoShow: boolean;
}

/** Gästeliste eines Angebots zum Abhaken vor Ort. */
export function GuestList({ offerId, guests, readOnly, canMarkNoShow }: GuestListProps) {
  const { t } = useT();
  const m = t.checkin.guests;

  return (
    <Card className="mb-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-headline text-text-primary">{m.title}</h2>
          {!readOnly && <p className="mt-1 text-callout text-text-secondary">{m.intro}</p>}
        </div>
        {!readOnly && (
          <Link href="/einloesen" className="text-subhead text-text-link hover:underline">
            {m.toCheckin}
          </Link>
        )}
      </div>
      <ul className="mt-4 divide-y divide-border-subtle">
        {guests.map((guest) => (
          <GuestRow
            key={guest.voucherId}
            guest={guest}
            offerId={offerId}
            readOnly={readOnly}
            canMarkNoShow={canMarkNoShow}
          />
        ))}
      </ul>
    </Card>
  );
}

function GuestRow({
  guest,
  offerId,
  readOnly,
  canMarkNoShow,
}: {
  guest: Guest;
  offerId: string;
  readOnly: boolean;
  canMarkNoShow: boolean;
}) {
  const { t, locale } = useT();
  const m = t.checkin.guests;
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [redeemState, redeemAction, redeeming] = useActionState<RedeemState, FormData>(
    redeemCodeAction,
    {},
  );
  const [noShowState, noShowAction, marking] = useActionState<NoShowState, FormData>(
    markNoShowAction,
    {},
  );
  const active = guest.status === 'aktiv' && !readOnly;
  const error = redeemState.error ?? noShowState.error;

  return (
    <li className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-body-strong text-text-primary">{guest.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-footnote text-text-secondary">
            <span className="text-text-primary">{guest.shortCode}</span>
            <span aria-hidden>·</span>
            <span>{t.checkin.seats(guest.seats)}</span>
            {guest.isPaid && (
              <>
                <span aria-hidden>·</span>
                <span>{m.paid}</span>
              </>
            )}
            {guest.redeemedLabel && (
              <>
                <span aria-hidden>·</span>
                <span>{m.redeemedAt(guest.redeemedLabel)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <VoucherStatusBadge status={guest.status} locale={locale} />
          {active && !confirmNoShow && (
            <>
              <form action={redeemAction}>
                <input type="hidden" name="code" value={guest.shortCode} />
                <Button type="submit" disabled={redeeming || marking} className="px-4">
                  {redeeming ? m.redeeming : m.redeem}
                </Button>
              </form>
              {canMarkNoShow && (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3"
                  disabled={redeeming || marking}
                  onClick={() => setConfirmNoShow(true)}
                >
                  {m.noShow}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {active && confirmNoShow && (
        <form
          action={noShowAction}
          className="mt-3 rounded-card bg-status-warning-subtle px-4 py-3 text-status-warning-on-subtle"
        >
          <input type="hidden" name="voucher_id" value={guest.voucherId} />
          <input type="hidden" name="offer_id" value={offerId} />
          <input type="hidden" name="paid" value={guest.isPaid ? '1' : '0'} />
          <p className="text-body-strong">{m.noShowQuestion}</p>
          <p className="mt-0.5 text-callout">
            {guest.isPaid ? m.noShowPaidWarning : m.noShowWarning}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={marking}
              className="inline-flex min-h-11 items-center rounded-button bg-status-error-solid px-4 text-subhead font-semibold text-status-error-on-solid disabled:opacity-60"
            >
              {marking ? m.noShowMarking : m.noShowConfirm}
            </button>
            <Button
              type="button"
              variant="ghost"
              className="px-3"
              disabled={marking}
              onClick={() => setConfirmNoShow(false)}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-callout text-status-error-text">
          {error}
        </p>
      )}
    </li>
  );
}
