'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/app/actions';
import { Button, Field, inputClass } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { NEXT_PARAM } from '@/lib/safe-redirect';

export function LoginForm({ next }: { next?: string | null }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name={NEXT_PARAM} value={next} /> : null}
      <Field id="email" label={t.common.login.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className={inputClass}
        />
      </Field>
      <Field id="password" label={t.common.login.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? t.common.login.submitting : t.common.login.submit}
      </Button>
    </form>
  );
}
