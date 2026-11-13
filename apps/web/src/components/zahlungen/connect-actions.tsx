'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import {
  openStripeDashboardAction,
  startOnboardingAction,
  type ConnectActionState,
} from '@/app/(portal)/auszahlungen/actions';

const INITIAL_STATE: ConnectActionState = {};

export function OnboardingButton() {
  const { t } = useT();
  const [state, action, pending] = useActionState(startOnboardingAction, INITIAL_STATE);
  return (
    <form action={action}>
      <Button type="submit" disabled={pending}>
        {pending ? t.payments.opening : t.payments.setup}
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
  const { t } = useT();
  const [state, action, pending] = useActionState(openStripeDashboardAction, INITIAL_STATE);
  return (
    <form action={action}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t.payments.opening : t.payments.dashboard}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-3 text-footnote text-status-error-text">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
