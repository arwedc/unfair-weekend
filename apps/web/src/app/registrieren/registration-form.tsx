'use client';

import { useActionState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { registerCompanyAction, type RegistrationState } from './actions';

type FieldName =
  'company_name' | 'location_name' | 'street' | 'postal_code' | 'city' | 'phone' | 'website';

export function RegistrationForm() {
  const [state, action, pending] = useActionState<RegistrationState, FormData>(
    registerCompanyAction,
    {},
  );
  const { t } = useT();
  const m = t.onboarding.registration;
  const inputFields: [FieldName, string, string][] = [
    ['company_name', m.companyName, m.companyNamePlaceholder],
    ['location_name', m.locationName, m.locationNamePlaceholder],
    ['street', m.street, ''],
    ['postal_code', m.postalCode, '48143'],
    ['city', m.city, 'Münster'],
    ['phone', m.phone, '+49 …'],
    ['website', m.website, 'https://…'],
  ];

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
      <Field id="company_description" label={m.description}>
        <textarea
          id="company_description"
          name="company_description"
          maxLength={2000}
          rows={3}
          defaultValue={state.values?.company_description}
          className={inputClass}
        />
      </Field>
      <p className="text-footnote text-text-secondary">{m.privacy}</p>
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
