'use client';

import { useActionState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { signUpAction, type SignUpState } from './actions';

export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUpAction, {});

  if (state.sent) {
    return (
      <div className="space-y-3" role="status">
        <h2 className="text-headline text-text-primary">E-Mail bestätigen</h2>
        <p className="text-callout text-text-secondary">
          Wir haben einen Bestätigungslink an <strong>{state.email}</strong> geschickt. Öffne ihn,
          um mit deinen Unternehmensangaben fortzufahren.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="first_name" label="Vorname">
          <input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            required
            maxLength={50}
            className={inputClass}
          />
        </Field>
        <Field id="last_name" label="Nachname">
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
      <Field id="email" label="E-Mail">
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
      <Field id="password" label="Passwort" hint="Mindestens 8 Zeichen.">
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
        {pending ? 'Konto wird erstellt …' : 'Weiter zur Bestätigung'}
      </Button>
    </form>
  );
}
