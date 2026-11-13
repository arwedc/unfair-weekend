'use client';

import { useActionState, useState } from 'react';
import type { CancelOfferState } from '@/app/(portal)/angebote/actions';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { useT } from '@/lib/i18n/context';

interface CancelOfferProps {
  action: (prev: CancelOfferState, formData: FormData) => Promise<CancelOfferState>;
  seatsTaken: number;
}

/** Angebot absagen (cancel_offer). Zweistufig, damit niemand aus Versehen absagt. */
export function CancelOffer({ action, seatsTaken }: CancelOfferProps) {
  const { t } = useT();
  const m = t.offers.cancel;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <Card className="mt-8 border-status-error-subtle p-6">
      <h2 className="text-headline text-text-primary">{m.title}</h2>
      <p className="mt-1 text-callout text-text-secondary">
        {seatsTaken > 0 ? m.withCodes(seatsTaken) : m.withoutCodes} {m.irreversible}
      </p>

      {!open ? (
        <Button type="button" variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          {m.open}
        </Button>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <Field id="cancel-reason" label={m.reason} hint={m.reasonHint}>
            <textarea
              id="cancel-reason"
              name="reason"
              rows={3}
              maxLength={500}
              className={inputClass}
            />
          </Field>
          {state.error && (
            <p role="alert" className="text-callout text-status-error-text">
              {state.error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-button bg-status-error-solid px-5 text-body-strong text-status-error-on-solid disabled:opacity-60"
            >
              {pending ? m.confirming : m.confirm}
            </button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
