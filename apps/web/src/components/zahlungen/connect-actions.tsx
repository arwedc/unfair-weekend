'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import {
  openStripeDashboardAction,
  startOnboardingAction,
  type ConnectActionState,
} from '@/app/(portal)/auszahlungen/actions';

const INITIAL_STATE: ConnectActionState = {};

export function OnboardingButton() {
  const [state, action, pending] = useActionState(startOnboardingAction, INITIAL_STATE);
  return (
    <form action={action}>
      <Button type="submit" disabled={pending}>
        {pending ? 'Stripe wird geöffnet …' : 'Auszahlungen einrichten'}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-3 text-footnote text-status-error-text">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function StripeDashboardButton() {
  const [state, action, pending] = useActionState(openStripeDashboardAction, INITIAL_STATE);
  return (
    <form action={action}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Stripe wird geöffnet …' : 'Stripe-Dashboard öffnen'}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-3 text-footnote text-status-error-text">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
