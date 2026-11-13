'use client';

import type { RedeemedCode } from '@/app/(portal)/einloesen/actions';
import { useT } from '@/lib/i18n/context';

/** Grüne Bestätigung nach dem Einlösen: wer, wie viele Plätze, welches Angebot. */
export function RedeemedNotice({ code }: { code: RedeemedCode }) {
  const { t } = useT();
  return (
    <div
      role="status"
      className="rounded-card bg-status-success-subtle px-4 py-3 text-status-success-on-subtle"
    >
      <p className="text-headline">
        <span aria-hidden>✓ </span>
        {t.checkin.redeemed}: {t.checkin.guestSummary(code.guest, code.seats)}
      </p>
      <p className="mt-0.5 text-callout">
        {code.offerTitle} · {code.shortCode}
      </p>
    </div>
  );
}
