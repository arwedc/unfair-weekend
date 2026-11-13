'use client';

import { useActionState } from 'react';
import { formatCommission } from '@repo/shared';
import { Button, Field, inputClass } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
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
  const { locale, t } = useT();
  const a = t.admin;
  const [state, action, pending] = useActionState(savePaymentSettingsAction, INITIAL_STATE);
  const currentEnabled = state.values?.payments_enabled ?? paymentsEnabled;
  const percentValue =
    state.values?.commission_percent ??
    (locale === 'en' ? String(commissionBps / 100) : String(commissionBps / 100).replace('.', ','));

  return (
    <form action={action} className="space-y-5">
      <Field
        id="commission_percent"
        label={a.commissionForm}
        hint={a.commissionHint(
          locale === 'en'
            ? formatCommission(commissionBps).replace(',', '.')
            : formatCommission(commissionBps),
        )}
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
          {a.enablePayments}
        </label>
        {offersWithoutPayoutAccount > 0 ? (
          <p
            role="alert"
            className="mt-2 rounded-card bg-status-warning-subtle px-4 py-3 text-callout text-status-warning-on-subtle"
          >
            {a.offersWithoutAccount(offersWithoutPayoutAccount)}
          </p>
        ) : null}
        <label className="mt-3 flex items-start gap-3 text-footnote text-text-secondary">
          <input
            type="checkbox"
            name="confirm_enable"
            defaultChecked={state.values?.confirm_enable ?? paymentsEnabled}
            className="mt-0.5 size-4 accent-accent-solid"
          />
          <span>{a.confirmEnable}</span>
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
          {a.saved}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? a.saving : a.save}
      </Button>
    </form>
  );
}
