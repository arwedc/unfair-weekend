'use client';

import { useActionState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { registerCompanyAction, type RegistrationState } from './actions';

const inputFields = [
  ['company_name', 'Unternehmen', 'z. B. Café Morgenrot'],
  ['location_name', 'Name des Standorts', 'z. B. Café Morgenrot Münster'],
  ['street', 'Straße und Hausnummer', ''],
  ['postal_code', 'Postleitzahl', '48143'],
  ['city', 'Ort', 'Münster'],
  ['phone', 'Telefonnummer für Rückfragen', '+49 …'],
  ['website', 'Website (optional)', 'https://…'],
] as const;

export function RegistrationForm() {
  const [state, action, pending] = useActionState<RegistrationState, FormData>(
    registerCompanyAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {inputFields.map(([name, label, placeholder]) => (
        <Field key={name} id={name} label={label}>
          <input
            id={name}
            name={name}
            required={name !== 'website'}
            maxLength={name === 'street' ? 120 : name === 'phone' ? 40 : 100}
            autoComplete={
              name === 'street'
                ? 'street-address'
                : name === 'postal_code'
                  ? 'postal-code'
                  : undefined
            }
            placeholder={placeholder}
            defaultValue={state.values?.[name]}
            className={inputClass}
          />
        </Field>
      ))}
      <Field id="company_description" label="Was bietet ihr an? (optional)">
        <textarea
          id="company_description"
          name="company_description"
          maxLength={2000}
          rows={3}
          defaultValue={state.values?.company_description}
          className={inputClass}
        />
      </Field>
      <p className="text-footnote text-text-secondary">
        Wir nutzen deine bestätigte E-Mail-Adresse und Telefonnummer zur Kontaktaufnahme. Wir prüfen
        die Angaben und melden uns mit der Entscheidung oder bei Rückfragen. Angebote kannst du nach
        der Freischaltung veröffentlichen.
      </p>
      {state.error ? (
        <p
          role="alert"
          className="rounded-input bg-status-error-subtle px-3 py-2 text-footnote text-status-error-on-subtle"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Antrag wird gesendet …' : 'Antrag zur Prüfung senden'}
      </Button>
    </form>
  );
}
