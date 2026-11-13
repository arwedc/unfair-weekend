'use client';

import { useActionState } from 'react';
import { formatCommission } from '@repo/shared';
import { Button, Field, inputClass } from '@/components/ui';
import {
  savePaymentSettingsAction,
  type PaymentSettingsActionState,
} from '@/app/(admin)/admin/zahlungen/actions';

const INITIAL_STATE: PaymentSettingsActionState = {};

export function PaymentSettingsForm({
  paymentsEnabled,
  commissionBps,
  offersWithoutPayoutAccount,
}: {
  paymentsEnabled: boolean;
  commissionBps: number;
  offersWithoutPayoutAccount: number;
}) {
  const [state, action, pending] = useActionState(savePaymentSettingsAction, INITIAL_STATE);
  const currentEnabled = state.values?.payments_enabled ?? paymentsEnabled;
  const percentValue =
    state.values?.commission_percent ?? String(commissionBps / 100).replace('.', ',');

  return (
    <form action={action} className="space-y-5">
      <Field
        id="commission_percent"
        label="Provision in Prozent"
        hint={`Aktuell ${formatCommission(commissionBps)}. Gilt nur für neue Buchungen.`}
      >
        <div className="flex max-w-xs items-center gap-2">
          <input
            id="commission_percent"
            name="commission_percent"
            type="text"
            inputMode="decimal"
            required
            defaultValue={percentValue}
            className={inputClass}
            aria-describedby="commission_percent-hint"
          />
          <span aria-hidden className="text-body text-text-secondary">
            %
          </span>
        </div>
      </Field>

      <div>
        <label className="flex min-h-11 items-center gap-3 text-subhead text-text-primary">
          <input
            type="checkbox"
            name="payments_enabled"
            defaultChecked={currentEnabled}
            className="size-5 accent-accent-solid"
          />
          Bezahlung in der App aktivieren
        </label>
        {offersWithoutPayoutAccount > 0 ? (
          <p
            role="alert"
            className="mt-2 rounded-card bg-status-warning-subtle px-4 py-3 text-callout text-status-warning-on-subtle"
          >
            Wenn du das Flag einschaltest, können {offersWithoutPayoutAccount}{' '}
            {offersWithoutPayoutAccount === 1 ? 'aktives Angebot' : 'aktive Angebote'} ohne
            eingerichtetes Stripe-Konto nicht mehr gebucht werden.
          </p>
        ) : null}
        <label className="mt-3 flex items-start gap-3 text-footnote text-text-secondary">
          <input
            type="checkbox"
            name="confirm_enable"
            defaultChecked={state.values?.confirm_enable ?? paymentsEnabled}
            className="mt-0.5 size-4 accent-accent-solid"
          />
          <span>
            Ich habe die Aktivierung im gemeinsamen Dev-Projekt mit Ben und @arwedc abgestimmt.
          </span>
        </label>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-card bg-status-error-subtle px-4 py-3 text-callout text-status-error-on-subtle"
        >
          {state.error}
        </p>
      ) : state.saved ? (
        <p
          role="status"
          className="rounded-card bg-status-success-subtle px-4 py-3 text-callout text-status-success-on-subtle"
        >
          Einstellungen gespeichert.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Wird gespeichert …' : 'Einstellungen speichern'}
      </Button>
    </form>
  );
}
