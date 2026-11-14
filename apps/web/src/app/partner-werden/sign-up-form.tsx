'use client';

import { useActionState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { signUpAction, type SignUpState } from './actions';

export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUpAction, {});
  const { t } = useT();
  const m = t.onboarding.signUp;

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="first_name" label={m.firstName}>
          <input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            required
            maxLength={50}
            className={inputClass}
          />
        </Field>
        <Field id="last_name" label={m.lastName}>
          <input
            id="last_name"
            name="last_name"
            autoComplete="family-name"
            required
            maxLength={50}
            className={inputClass}
          />
        </Field>
      </div>
      <Field id="email" label={m.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={inputClass}
        />
      </Field>
      <Field id="password" label={m.password} hint={m.passwordHint}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          className={inputClass}
        />
      </Field>
      {state.error ? (
        <p
          role="alert"
          className="rounded-input bg-status-error-subtle px-3 py-2 text-footnote text-status-error-on-subtle"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? m.submitting : m.submit}
      </Button>
    </form>
  );
}
