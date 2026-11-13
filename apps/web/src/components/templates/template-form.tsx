'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  OFFER_CATEGORIES,
  OFFER_CATEGORY_LABELS,
  OFFER_LIMITS,
  OFFER_TEMPLATE_LIMITS,
} from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { Notice, TypePicker, type OfferType } from '@/components/offers/form-parts';
import { ImagePicker } from '@/components/offers/image-picker';
import { Button, buttonClass, Card, Field, inputClass } from '@/components/ui';
import { parseEuroToCents } from '@/lib/offers/form';
import {
  DURATION_UNIT_LABELS,
  DURATION_UNITS,
  type TemplateFormField,
  type TemplateFormState,
  type TemplateFormValues,
} from '@/lib/templates/form';

export interface TemplateFormProps {
  action: (prev: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  mode: 'create' | 'edit';
  locationId: string;
  initialValues: TemplateFormValues;
  minDiscountPercent: number;
}

/**
 * Formular für Angebotsvorlagen. Wie ein Angebot, aber ohne Adresse und ohne Zeitpunkt:
 * statt Beginn und Ende steht hier nur die Dauer.
 */
export function TemplateForm({
  action,
  mode,
  locationId,
  initialValues,
  minDiscountPercent,
}: TemplateFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    errors: {},
    values: initialValues,
  });
  const values = state.values ?? initialValues;
  const formRef = useRef<HTMLFormElement>(null);

  const [type, setType] = useState<OfferType>(
    (values.type as OfferType | undefined) ?? 'einzeltermin',
  );
  const [originalPrice, setOriginalPrice] = useState(values.original_price ?? '');
  const [dealPrice, setDealPrice] = useState(values.deal_price ?? '');

  // Nach einer Antwort mit Fehlern das erste fehlerhafte Feld fokussieren.
  useEffect(() => {
    if (Object.keys(state.errors).length === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const err = (field: TemplateFormField) => state.errors[field];
  const val = (field: Exclude<TemplateFormField, 'image_paths'>) => values[field];
  const aria = (field: TemplateFormField) =>
    err(field)
      ? { 'aria-invalid': true as const, 'aria-describedby': `${field}-error` }
      : { 'aria-describedby': `${field}-hint` };

  // Live-Vorschau des Rabatts, die echte Prüfung macht der Server.
  const originalCents = parseEuroToCents(originalPrice);
  const dealCents = parseEuroToCents(dealPrice);
  const discount =
    originalCents && dealCents !== null && dealCents < originalCents
      ? discountPercent(originalCents, dealCents)
      : null;
  const discountTooLow = discount !== null && discount < minDiscountPercent;

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-headline text-text-primary">Vorlage</h2>
        <Field
          id="name"
          label="Name der Vorlage"
          hint="Nur für dich sichtbar, z. B. „Kochkurs Standard“ oder „Mittagstisch“."
          error={err('name')}
        >
          <input
            id="name"
            name="name"
            maxLength={OFFER_TEMPLATE_LIMITS.nameMax}
            defaultValue={val('name')}
            className={inputClass}
            {...aria('name')}
          />
        </Field>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-headline text-text-primary">Worum geht es?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="title"
            label="Titel"
            hint="So heißt das Angebot später in der App."
            error={err('title')}
            className="sm:col-span-2"
          >
            <input
              id="title"
              name="title"
              maxLength={OFFER_LIMITS.titleMax}
              defaultValue={val('title')}
              className={inputClass}
              {...aria('title')}
            />
          </Field>
          <Field
            id="description"
            label="Beschreibung"
            hint="Was erwartet die Leute? Was ist inklusive, was sollen sie mitbringen?"
            error={err('description')}
            className="sm:col-span-2"
          >
            <textarea
              id="description"
              name="description"
              rows={5}
              maxLength={OFFER_LIMITS.descriptionMax}
              defaultValue={val('description')}
              className={inputClass}
              {...aria('description')}
            />
          </Field>
          <Field id="category" label="Kategorie" error={err('category')}>
            <select
              id="category"
              name="category"
              defaultValue={val('category') ?? ''}
              className={inputClass}
              {...aria('category')}
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {OFFER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {OFFER_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <ImagePicker
              locationId={locationId}
              initialPaths={values.image_paths ?? []}
              error={err('image_paths')}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-headline text-text-primary">Art und Dauer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TypePicker value={type} onChange={setType} />
          <Field
            id="duration_value"
            label={type === 'einzeltermin' ? 'Dauer des Termins' : 'Einlösbar für'}
            hint={`Den Beginn wählst du erst beim Anlegen des Angebots. Höchstens ${OFFER_LIMITS.maxDurationDays} Tage.`}
            error={err('duration_value')}
            className="sm:col-span-2"
          >
            <div className="flex gap-3">
              <input
                id="duration_value"
                name="duration_value"
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={val('duration_value')}
                className={`${inputClass} max-w-32`}
                {...aria('duration_value')}
              />
              <select
                name="duration_unit"
                aria-label="Einheit der Dauer"
                defaultValue={val('duration_unit') ?? 'stunden'}
                className={`${inputClass} max-w-44`}
              >
                {DURATION_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {DURATION_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-headline text-text-primary">Preis und Plätze</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="original_price" label="Originalpreis (€)" error={err('original_price')}>
            <input
              id="original_price"
              name="original_price"
              inputMode="decimal"
              placeholder="69,00"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              className={inputClass}
              {...aria('original_price')}
            />
          </Field>
          <Field
            id="deal_price"
            label="Deal-Preis (€)"
            hint={
              discount !== null ? (
                <span className={discountTooLow ? 'text-status-error-text' : 'text-text-accent'}>
                  {formatDiscount(discount)} Rabatt
                  {discountTooLow ? ` (mindestens ${minDiscountPercent} %)` : ''}
                </span>
              ) : originalCents ? (
                `Mindestens ${minDiscountPercent} % unter ${formatPrice(originalCents)}.`
              ) : (
                `Mindestens ${minDiscountPercent} % Rabatt.`
              )
            }
            error={err('deal_price')}
          >
            <input
              id="deal_price"
              name="deal_price"
              inputMode="decimal"
              placeholder="39,00"
              value={dealPrice}
              onChange={(e) => setDealPrice(e.target.value)}
              className={inputClass}
              {...aria('deal_price')}
            />
          </Field>
          <Field id="capacity" label="Plätze insgesamt" error={err('capacity')}>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              max={OFFER_LIMITS.capacityMax}
              defaultValue={val('capacity') ?? '10'}
              className={inputClass}
              {...aria('capacity')}
            />
          </Field>
          <Field
            id="max_per_user"
            label="Max. Plätze pro Person"
            hint="Wie viele Plätze eine Person mit einem Code höchstens holen darf."
            error={err('max_per_user')}
          >
            <input
              id="max_per_user"
              name="max_per_user"
              type="number"
              min={1}
              max={OFFER_LIMITS.maxPerUserMax}
              defaultValue={val('max_per_user') ?? '2'}
              className={inputClass}
              {...aria('max_per_user')}
            />
          </Field>
        </div>
      </Card>

      {state.formError ? <Notice tone="error">{state.formError}</Notice> : null}
      {state.saved ? <Notice tone="success">Vorlage gespeichert.</Notice> : null}

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/vorlagen"
          className={buttonClass(
            'ghost',
            'border border-border-default hover:border-border-strong',
          )}
        >
          {mode === 'create' ? 'Abbrechen' : 'Zurück'}
        </Link>
        <Button type="submit" disabled={pending}>
          {pending
            ? 'Wird gespeichert …'
            : mode === 'create'
              ? 'Vorlage speichern'
              : 'Änderungen speichern'}
        </Button>
      </div>
    </form>
  );
}
