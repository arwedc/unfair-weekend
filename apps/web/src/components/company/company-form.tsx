'use client';

import { useActionState, useState } from 'react';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { LogoPicker } from '@/components/company/logo-picker';
import type { CompanyFormField, CompanyFormState, CompanyFormValues } from '@/lib/company/form';

const DESCRIPTION_MAX = 2000;

export function CompanyForm({
  action,
  companyId,
  initialValues,
}: {
  action: (prev: CompanyFormState, formData: FormData) => Promise<CompanyFormState>;
  companyId: string;
  initialValues: CompanyFormValues;
}) {
  const [state, formAction, pending] = useActionState(action, {
    errors: {},
    values: initialValues,
  });
  const values = state.values ?? initialValues;
  const [name, setName] = useState(values.name ?? '');
  const [description, setDescription] = useState(values.description ?? '');

  const err = (field: CompanyFormField) => state.errors[field];
  const aria = (field: CompanyFormField) =>
    err(field)
      ? { 'aria-invalid': true as const, 'aria-describedby': `${field}-error` }
      : { 'aria-describedby': `${field}-hint` };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Card className="space-y-5 p-5 sm:p-6">
        <LogoPicker
          // initialValues kommt nach dem Speichern frisch vom Server (revalidatePath):
          // dann neu aufbauen, damit der Picker vom gespeicherten Logo ausgeht.
          key={initialValues.logo_path ?? ''}
          companyId={companyId}
          companyName={name}
          initialPath={values.logo_path ?? ''}
          savedPath={initialValues.logo_path ?? ''}
          error={err('logo_path')}
        />
        <Field
          id="name"
          label="Name des Unternehmens"
          hint="So erscheint ihr in der App bei allen Angeboten."
          error={err('name')}
        >
          <input
            id="name"
            name="name"
            maxLength={100}
            autoComplete="organization"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            {...aria('name')}
          />
        </Field>
        <Field
          id="description"
          label="Beschreibung"
          hint={`Wer seid ihr, was macht euch aus? ${description.length} / ${DESCRIPTION_MAX} Zeichen.`}
          error={err('description')}
        >
          <textarea
            id="description"
            name="description"
            rows={6}
            maxLength={DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            {...aria('description')}
          />
        </Field>
      </Card>

      {state.formError ? (
        <p
          role="alert"
          className="rounded-card bg-status-error-subtle px-4 py-3 text-subhead text-status-error-on-subtle"
        >
          {state.formError}
        </p>
      ) : null}
      {state.saved ? (
        <p
          role="status"
          className="rounded-card bg-status-success-subtle px-4 py-3 text-subhead text-status-success-on-subtle"
        >
          Profil gespeichert.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Wird gespeichert …' : 'Änderungen speichern'}
        </Button>
      </div>
    </form>
  );
}
