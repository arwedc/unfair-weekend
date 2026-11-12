'use client';

import { useActionState, useState } from 'react';
import { OFFER_TYPE_LABELS, OFFER_TYPES, type OfferType } from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { createOfferAction, type OfferFormState } from '@/app/actions';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { CATEGORIES } from '@/lib/offers/categories';
import { MIN_DISCOUNT_PERCENT, parseEuroToCents, type CreateOfferField } from '@/lib/offers/schema';

const initialState: OfferFormState = { errors: {}, values: {} };

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

export function OfferForm({ defaultAddress }: { defaultAddress: string }) {
  const [state, action, pending] = useActionState(createOfferAction, initialState);
  const [type, setType] = useState<OfferType>(
    (state.values.type as OfferType | undefined) ?? 'einzeltermin',
  );
  const [originalPrice, setOriginalPrice] = useState(state.values.originalPriceCents ?? '');
  const [dealPrice, setDealPrice] = useState(state.values.dealPriceCents ?? '');

  const err = (field: CreateOfferField) => state.errors[field];
  const val = (field: CreateOfferField) => state.values[field];
  const aria = (field: CreateOfferField) =>
    err(field)
      ? { 'aria-invalid': true as const, 'aria-describedby': `${field}-error` }
      : { 'aria-describedby': `${field}-hint` };

  // Live-Vorschau des Rabatts, die echte Prüfung macht der Server.
  const originalCents = parseEuroToCents(originalPrice);
  const dealCents = parseEuroToCents(dealPrice);
  const discount =
    originalCents && dealCents && dealCents < originalCents
      ? discountPercent(originalCents, dealCents)
      : null;
  const discountTooLow = discount !== null && discount < MIN_DISCOUNT_PERCENT;

  return (
    <form action={action} className="space-y-5" noValidate>
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
            maxLength={80}
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
            maxLength={2000}
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
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Wann?">
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-subhead text-text-primary">Art des Angebots</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {OFFER_TYPES.map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-input border p-3.5 transition-colors ${
                  type === t
                    ? 'border-accent-solid bg-accent-subtle'
                    : 'border-border-default bg-surface-default hover:border-border-strong'
                }`}
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
          id="startsAt"
          label={type === 'einzeltermin' ? 'Beginn' : 'Einlösbar ab'}
          error={err('startsAt')}
        >
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={val('startsAt')}
            className={inputClass}
            {...aria('startsAt')}
          />
        </Field>
        <Field
          id="endsAt"
          label={type === 'einzeltermin' ? 'Ende' : 'Einlösbar bis'}
          hint="Uhrzeiten in deutscher Zeit."
          error={err('endsAt')}
        >
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={val('endsAt')}
            className={inputClass}
            {...aria('endsAt')}
          />
        </Field>
      </Section>

      <Section title="Preis und Plätze">
        <Field id="originalPriceCents" label="Originalpreis (€)" error={err('originalPriceCents')}>
          <input
            id="originalPriceCents"
            name="originalPriceCents"
            inputMode="decimal"
            placeholder="69,00"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            className={inputClass}
            {...aria('originalPriceCents')}
          />
        </Field>
        <Field
          id="dealPriceCents"
          label="Deal-Preis (€)"
          hint={
            discount !== null ? (
              <span className={discountTooLow ? 'text-status-error-text' : 'text-text-accent'}>
                {formatDiscount(discount)} Rabatt
                {discountTooLow ? ` (mindestens ${MIN_DISCOUNT_PERCENT} %)` : ''}
              </span>
            ) : originalCents ? (
              `Mindestens ${MIN_DISCOUNT_PERCENT} % unter ${formatPrice(originalCents)}.`
            ) : (
              `Mindestens ${MIN_DISCOUNT_PERCENT} % Rabatt.`
            )
          }
          error={err('dealPriceCents')}
        >
          <input
            id="dealPriceCents"
            name="dealPriceCents"
            inputMode="decimal"
            placeholder="39,00"
            value={dealPrice}
            onChange={(e) => setDealPrice(e.target.value)}
            className={inputClass}
            {...aria('dealPriceCents')}
          />
        </Field>
        <Field id="capacity" label="Plätze insgesamt" error={err('capacity')}>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={500}
            defaultValue={val('capacity') ?? '10'}
            className={inputClass}
            {...aria('capacity')}
          />
        </Field>
        <Field
          id="maxPerUser"
          label="Max. Plätze pro Person"
          hint="Wie viele Codes eine Person höchstens holen darf."
          error={err('maxPerUser')}
        >
          <input
            id="maxPerUser"
            name="maxPerUser"
            type="number"
            min={1}
            max={20}
            defaultValue={val('maxPerUser') ?? '2'}
            className={inputClass}
            {...aria('maxPerUser')}
          />
        </Field>
      </Section>

      <Section title="Wo?">
        <Field
          id="address"
          label="Adresse"
          hint="Vorausgefüllt mit deinem Standort. Abweichend? Einfach ändern."
          error={err('address')}
          className="sm:col-span-2"
        >
          <input
            id="address"
            name="address"
            defaultValue={val('address') ?? defaultAddress}
            className={inputClass}
            {...aria('address')}
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

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Wird gespeichert …' : 'Angebot veröffentlichen'}
        </Button>
      </div>
    </form>
  );
}
