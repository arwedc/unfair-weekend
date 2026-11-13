'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { Enums } from '@repo/shared';
import { redeemCodeAction, type RedeemState } from '@/app/(portal)/einloesen/actions';
import { Button, buttonClass } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { RedeemedNotice } from './redeemed-notice';

interface RedeemTokenProps {
  token: string;
  offerId: string;
  status: Enums<'voucher_status'>;
  /** Fertig formatierte Einlösezeit (Europe/Berlin), falls schon eingelöst. */
  redeemedLabel: string | null;
}

/**
 * Bestätigung für einen gescannten QR-Link. Eingelöst wird erst beim Klick,
 * nie beim Öffnen der Seite (Link-Vorschauen und Prefetch würden sonst einlösen).
 * Bleibt nach dem Einlösen stehen, auch wenn die Seite neu geladen wird.
 */
export function RedeemToken({ token, offerId, status, redeemedLabel }: RedeemTokenProps) {
  const { t, labels } = useT();
  const m = t.checkin.token;
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeemCodeAction, {});

  const links = (
    <div className="flex flex-wrap gap-3">
      <Link href="/einloesen" className={buttonClass('secondary')}>
        {m.nextCode}
      </Link>
      <Link href={`/angebote/${offerId}`} className={buttonClass('ghost')}>
        {m.toGuestList}
      </Link>
    </div>
  );

  if (state.ok) {
    return (
      <div className="space-y-4">
        <RedeemedNotice code={state.ok} />
        {links}
      </div>
    );
  }

  if (status !== 'aktiv') {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-card bg-status-warning-subtle px-4 py-3 text-callout text-status-warning-on-subtle"
        >
          {status === 'eingeloest' && redeemedLabel
            ? m.alreadyRedeemed(redeemedLabel)
            : m.notRedeemable(labels.voucherStatus[status])}
        </p>
        {links}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="code" value={token} />
      {state.error && (
        <p role="alert" className="text-callout text-status-error-text">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? t.checkin.submitting : m.confirm}
      </Button>
    </form>
  );
}
