'use client';

import { useActionState, useState } from 'react';
import type { DeleteTemplateState } from '@/app/(portal)/vorlagen/actions';
import { Button, Card } from '@/components/ui';

interface DeleteTemplateProps {
  action: () => Promise<DeleteTemplateState>;
}

/** Vorlage löschen (delete_offer_template). Zweistufig, damit niemand aus Versehen löscht. */
export function DeleteTemplate({ action }: DeleteTemplateProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <Card className="mt-8 border-status-error-subtle p-6">
      <h2 className="text-headline text-text-primary">Vorlage löschen</h2>
      <p className="mt-1 text-callout text-text-secondary">
        Angebote, die du aus dieser Vorlage erstellt hast, bleiben unverändert.
      </p>

      {!open ? (
        <Button type="button" variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          Vorlage löschen …
        </Button>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
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
              {pending ? 'Wird gelöscht …' : 'Endgültig löschen'}
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
