'use client';

import { useActionState, useState } from 'react';
import type { CancelOfferState } from '@/app/(portal)/angebote/actions';
import { Button, Card, Field, inputClass } from '@/components/ui';

interface CancelOfferProps {
  action: (prev: CancelOfferState, formData: FormData) => Promise<CancelOfferState>;
  seatsTaken: number;
}

/** Angebot absagen (cancel_offer). Zweistufig, damit niemand aus Versehen absagt. */
export function CancelOffer({ action, seatsTaken }: CancelOfferProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <Card className="mt-8 border-status-error-subtle p-6">
      <h2 className="text-headline text-text-primary">Angebot absagen</h2>
      <p className="mt-1 text-callout text-text-secondary">
        {seatsTaken > 0
          ? `Alle aktiven Codes (${seatsTaken} Plätze vergeben) werden storniert und die Inhaber benachrichtigt.`
          : 'Das Angebot verschwindet sofort aus der App.'}{' '}
        Das lässt sich nicht rückgängig machen.
      </p>

      {!open ? (
        <Button type="button" variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          Angebot absagen …
        </Button>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <Field
            id="cancel-reason"
            label="Grund (optional)"
            hint="Wird den Code-Inhabern angezeigt. Höchstens 500 Zeichen."
          >
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
              {pending ? 'Wird abgesagt …' : 'Endgültig absagen'}
            </button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
