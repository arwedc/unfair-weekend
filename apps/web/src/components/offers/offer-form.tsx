'use client';

import { useActionState, useState } from 'react';
import {
  OFFER_CATEGORIES,
  OFFER_CATEGORY_LABELS,
  OFFER_LIMITS,
  OFFER_TYPE_LABELS,
  OFFER_TYPES,
  type Enums,
} from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { ImagePicker } from '@/components/offers/image-picker';
import {
  LOCKED_WHEN_CODES,
  parseEuroToCents,
  type OfferFormField,
  type OfferFormState,
  type OfferFormValues,
} from '@/lib/offers/form';

type OfferType = Enums<'offer_type'>;

const TYPE_HINTS: Record<OfferType, string> = {
  einzeltermin: 'Ein fester Termin, z. B. ein Kochkurs am Freitagabend.',
  zeitraum: 'Einlösbar in einem Zeitraum, z. B. eine Massage bis Sonntag.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 text-headline text-text-primary">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export interface OfferFormProps {
  action: (prev: OfferFormState, formData: FormData) => Promise<OfferFormState>;
  mode: 'create' | 'edit';
  locationId: string;
  initialValues: OfferFormValues;
  minDiscountPercent: number;
  /** Es gibt schon Codes: Zeit, Adresse und Preise sind gesperrt. */
  hasCodes?: boolean;
  /** Vergebene Plätze, das Kontingent kann nicht darunter sinken. */
  seatsTaken?: number;
}

export function OfferForm({
  action,
  mode,
  locationId,
  initialValues,
  minDiscountPercent,
  hasCodes = false,
  seatsTaken = 0,
}: OfferFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    errors: {},
    values: initialValues,
  });
  const values = state.values ?? initialValues;

  const [type, setType] = useState<OfferType>(
    (values.type as OfferType | undefined) ?? 'einzeltermin',
  );
  const [originalPrice, setOriginalPrice] = useState(values.original_price ?? '');
  const [dealPrice, setDealPrice] = useState(values.deal_price ?? '');

  const locked = (field: OfferFormField) => hasCodes && LOCKED_WHEN_CODES.includes(field);
  const err = (field: OfferFormField) => state.errors[field];
  const val = (field: Exclude<OfferFormField, 'image_paths'>) => values[field];
  const aria = (field: OfferFormField) =>
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
    <form action={formAction} className="space-y-5" noValidate>
      {hasCodes ? (
        <p className="rounded-card bg-accent-subtle px-4 py-3 text-subhead text-accent-on-subtle">
          Es haben sich schon Leute Codes geholt. Zeit, Adresse und Preise sind deshalb gesperrt.
          Titel, Beschreibung, Bilder, Kategorie und Plätze kannst du weiter ändern.
        </p>
      ) : null}

      <Section title="Worum geht es?">
        <Field
          id="title"
          label="Titel"
          hint="Kurz und eindeutig, z. B. „Sushi-Kurs für Einsteiger“."
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
      </Section>

      <Section title="Wann?">
        <fieldset className="sm:col-span-2" disabled={locked('type')}>
          <legend className="mb-1.5 text-subhead text-text-primary">Art des Angebots</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {OFFER_TYPES.map((t) => (
              <label
                key={t}
                className={`rounded-input border p-3.5 transition-colors ${
                  type === t
                    ? 'border-accent-solid bg-accent-subtle'
                    : 'border-border-default bg-surface-default hover:border-border-strong'
                } ${locked('type') ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                <span className="block text-body-strong text-text-primary">
                  {OFFER_TYPE_LABELS[t]}
                </span>
                <span className="mt-0.5 block text-footnote text-text-secondary">
                  {TYPE_HINTS[t]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          id="starts_at"
          label={type === 'einzeltermin' ? 'Beginn' : 'Einlösbar ab'}
          error={err('starts_at')}
        >
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={val('starts_at')}
            disabled={locked('starts_at')}
            className={inputClass}
            {...aria('starts_at')}
          />
        </Field>
        <Field
          id="ends_at"
          label={type === 'einzeltermin' ? 'Ende' : 'Einlösbar bis'}
          hint={`Uhrzeiten in deutscher Zeit, höchstens ${OFFER_LIMITS.maxDurationDays} Tage.`}
          error={err('ends_at')}
        >
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            defaultValue={val('ends_at')}
            disabled={locked('ends_at')}
            className={inputClass}
            {...aria('ends_at')}
          />
        </Field>
      </Section>

      <Section title="Preis und Plätze">
        <Field id="original_price" label="Originalpreis (€)" error={err('original_price')}>
          <input
            id="original_price"
            name="original_price"
            inputMode="decimal"
            placeholder="69,00"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            disabled={locked('original_price')}
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
            disabled={locked('deal_price')}
            className={inputClass}
            {...aria('deal_price')}
          />
        </Field>
        <Field
          id="capacity"
          label="Plätze insgesamt"
          hint={seatsTaken > 0 ? `${seatsTaken} schon vergeben, nicht weniger möglich.` : undefined}
          error={err('capacity')}
        >
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={Math.max(1, seatsTaken)}
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
      </Section>

      <Section title="Wo?">
        <Field
          id="street"
          label="Straße und Hausnummer"
          hint={mode === 'create' ? 'Vorausgefüllt mit deinem Standort.' : undefined}
          error={err('street')}
          className="sm:col-span-2"
        >
          <input
            id="street"
            name="street"
            autoComplete="street-address"
            defaultValue={val('street')}
            disabled={locked('street')}
            className={inputClass}
            {...aria('street')}
          />
        </Field>
        <Field id="postal_code" label="PLZ" error={err('postal_code')}>
          <input
            id="postal_code"
            name="postal_code"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            defaultValue={val('postal_code')}
            disabled={locked('postal_code')}
            className={inputClass}
            {...aria('postal_code')}
          />
        </Field>
        <Field id="city" label="Ort" error={err('city')}>
          <input
            id="city"
            name="city"
            autoComplete="address-level2"
            defaultValue={val('city')}
            disabled={locked('city')}
            className={inputClass}
            {...aria('city')}
          />
        </Field>
      </Section>

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
          Änderungen gespeichert.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending
            ? 'Wird gespeichert …'
            : mode === 'create'
              ? 'Angebot veröffentlichen'
              : 'Änderungen speichern'}
        </Button>
      </div>
    </form>
  );
}
