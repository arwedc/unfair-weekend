'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { redeemCodeAction, type RedeemState } from '@/app/(portal)/einloesen/actions';
import { Button, Field, inputClass } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { RedeemedNotice } from './redeemed-notice';

/**
 * Kurzcode eingeben und einlösen. Nach dem Einlösen ist das Feld wieder leer
 * (React setzt das Formular zurück), bereit für den nächsten Gast.
 */
export function RedeemForm() {
  const { t } = useT();
  const m = t.checkin;
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeemCodeAction, {});

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <Field id="code" label={m.codeLabel} hint={m.codeHint} error={state.error}>
          <input
            id="code"
            name="code"
            type="text"
            required
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="K7Q-4MX"
            defaultValue={state.input}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? 'code-error' : 'code-hint'}
            className={`${inputClass} text-voucher-code uppercase`}
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? m.submitting : m.submit}
        </Button>
      </form>

      {state.ok && (
        <div className="space-y-2">
          <RedeemedNotice code={state.ok} />
          <Link
            href={`/angebote/${state.ok.offerId}`}
            className="inline-block text-subhead text-text-link hover:underline"
          >
            {m.token.toGuestList}
          </Link>
        </div>
      )}
    </div>
  );
}
