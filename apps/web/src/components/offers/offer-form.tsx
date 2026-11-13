'use client';

import Link from 'next/link';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  OFFER_CATEGORIES,
  OFFER_CATEGORY_LABELS,
  OFFER_LIMITS,
  OFFER_TYPE_LABELS,
  OFFER_TYPES,
  type Enums,
} from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { Button, buttonClass, Card, Field, inputClass } from '@/components/ui';
import { ImagePicker } from '@/components/offers/image-picker';
import { StepProgress } from '@/components/offers/step-progress';
import {
  LOCKED_WHEN_CODES,
  parseEuroToCents,
  type OfferFormField,
  type OfferFormState,
  type OfferFormValues,
} from '@/lib/offers/form';
import {
  firstStepWithError,
  OFFER_STEPS,
  readFormValues,
  validateStep,
  type OfferStepId,
  type StepErrors,
} from '@/lib/offers/steps';

type OfferType = Enums<'offer_type'>;

const TYPE_HINTS: Record<OfferType, string> = {
  einzeltermin: 'Ein fester Termin, z. B. ein Kochkurs am Freitagabend.',
  zeitraum: 'Einlösbar in einem Zeitraum, z. B. eine Massage bis Sonntag.',
};

const LAST_STEP = OFFER_STEPS.length - 1;

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`h-4 w-4 ${direction === 'left' ? 'rotate-180' : ''}`}
    >
      <path
        d="M3 8h10m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-card px-4 py-3 text-subhead ${
        tone === 'error'
          ? 'bg-status-error-subtle text-status-error-on-subtle'
          : 'bg-status-success-subtle text-status-success-on-subtle'
      }`}
    >
      {children}
    </p>
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

/**
 * Formular für Angebote. Beim Anlegen ein Assistent in vier Schritten
 * (Worum geht es? → Wann? → Preis und Plätze → Wo?), beim Bearbeiten alles auf einer Seite.
 * Alle Felder bleiben im DOM (versteckte Schritte nur ausgeblendet), damit sie mitgeschickt werden.
 */
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
  const wizard = mode === 'create';

  const formRef = useRef<HTMLFormElement>(null);
  const headingRefs = useRef<(HTMLHeadingElement | null)[]>([]);

  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [errors, setErrors] = useState<StepErrors>(state.errors);
  const [navigated, setNavigated] = useState(false);

  const [type, setType] = useState<OfferType>(
    (values.type as OfferType | undefined) ?? 'einzeltermin',
  );
  const [originalPrice, setOriginalPrice] = useState(values.original_price ?? '');
  const [dealPrice, setDealPrice] = useState(values.deal_price ?? '');

  // Neue Antwort vom Server: Fehler übernehmen und zum ersten Schritt mit Fehler springen.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setErrors(state.errors);
    const target = firstStepWithError(state.errors);
    if (wizard && target !== null && target !== step) {
      setDirection(target < step ? 'back' : 'forward');
      setStep(target);
      setNavigated(true);
    }
  }

  // Nach einem Schrittwechsel die Überschrift fokussieren (Screenreader, Tastatur) und hochscrollen.
  useEffect(() => {
    if (!navigated) return;
    const heading = headingRefs.current[step];
    heading?.focus({ preventScroll: true });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step, navigated]);

  const locked = (field: OfferFormField) => hasCodes && LOCKED_WHEN_CODES.includes(field);
  const err = (field: OfferFormField) => errors[field];
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

  /** Prüft einen Schritt und ersetzt dessen Fehler. Gibt `true` zurück, wenn alles passt. */
  function checkStep(index: number): boolean {
    const def = OFFER_STEPS[index];
    if (!def || !formRef.current) return true;
    const found = validateStep(def.id, readFormValues(formRef.current), { minDiscountPercent });
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of def.fields) delete next[f];
      return { ...next, ...found };
    });
    return Object.keys(found).length === 0;
  }

  function goTo(index: number) {
    if (index === step || index < 0 || index > LAST_STEP) return;
    setDirection(index < step ? 'back' : 'forward');
    setStep(index);
    setReached((r) => Math.max(r, index));
    setNavigated(true);
  }

  function goNext() {
    if (!checkStep(step)) {
      // Erstes fehlerhaftes Feld fokussieren.
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>('section:not([hidden]) [aria-invalid="true"]')
          ?.focus();
      });
      return;
    }
    goTo(step + 1);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (!wizard) return;
    // Alle Schritte prüfen, falls jemand über die Fortschrittsleiste zurückgesprungen ist.
    for (let i = 0; i <= LAST_STEP; i++) {
      if (!checkStep(i)) {
        e.preventDefault();
        if (i !== step) goTo(i);
        return;
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    // Enter in einem Eingabefeld führt zum nächsten Schritt statt das Formular abzuschicken.
    if (!wizard || e.key !== 'Enter' || step === LAST_STEP) return;
    if (e.target instanceof HTMLInputElement) {
      e.preventDefault();
      goNext();
    }
  }

  const content: Record<OfferStepId, ReactNode> = {
    was: (
      <>
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
      </>
    ),
    wann: (
      <>
        <fieldset className="sm:col-span-2" disabled={locked('type')}>
          <legend className="mb-1.5 text-subhead text-text-primary">Art des Angebots</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {OFFER_TYPES.map((t) => (
              <label
                key={t}
                className={`relative rounded-input border p-4 transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-focus ${
                  type === t
                    ? 'border-accent-vivid bg-accent-subtle'
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
                <span
                  aria-hidden
                  className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    type === t ? 'border-accent-solid' : 'border-border-strong'
                  }`}
                >
                  {type === t ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-accent-solid" />
                  ) : null}
                </span>
                <span className="block pr-8 text-body-strong text-text-primary">
                  {OFFER_TYPE_LABELS[t]}
                </span>
                <span className="mt-0.5 block pr-8 text-footnote text-text-secondary">
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
      </>
    ),
    preis: (
      <>
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
        {wizard && discount !== null && !discountTooLow && originalCents && dealCents !== null ? (
          <div className="flex items-center gap-3 rounded-input bg-accent-subtle px-4 py-3 sm:col-span-2">
            <span className="rounded-badge bg-badge-deal-background px-2 py-1 text-subhead font-semibold text-badge-deal-foreground">
              {formatDiscount(discount)}
            </span>
            <p className="text-subhead text-accent-on-subtle">
              Statt <span className="line-through">{formatPrice(originalCents)}</span> nur{' '}
              <span className="font-semibold">{formatPrice(dealCents)}</span>. Man spart{' '}
              {formatPrice(originalCents - dealCents)}.
            </p>
          </div>
        ) : null}
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
      </>
    ),
    wo: (
      <>
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
      </>
    ),
  };

  if (!wizard) {
    return (
      <form ref={formRef} action={formAction} className="space-y-5" noValidate>
        {hasCodes ? (
          <p className="rounded-card bg-accent-subtle px-4 py-3 text-subhead text-accent-on-subtle">
            Es haben sich schon Leute Codes geholt. Zeit, Adresse und Preise sind deshalb gesperrt.
            Titel, Beschreibung, Bilder, Kategorie und Plätze kannst du weiter ändern.
          </p>
        ) : null}

        {OFFER_STEPS.map((s) => (
          <section key={s.id} aria-labelledby={`step-${s.id}`}>
            <Card className="p-5 sm:p-6">
              <h2 id={`step-${s.id}`} className="mb-4 text-headline text-text-primary">
                {s.title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">{content[s.id]}</div>
            </Card>
          </section>
        ))}

        {state.formError ? <Notice tone="error">{state.formError}</Notice> : null}
        {state.saved ? <Notice tone="success">Änderungen gespeichert.</Notice> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? 'Wird gespeichert …' : 'Änderungen speichern'}
          </Button>
        </div>
      </form>
    );
  }

  const isLast = step === LAST_STEP;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="scroll-mt-6"
      noValidate
    >
      <Card>
        <div className="border-b border-border-subtle px-5 pb-5 pt-5 sm:px-8 sm:pt-6">
          <StepProgress steps={OFFER_STEPS} current={step} reached={reached} onSelect={goTo} />
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {OFFER_STEPS.map((s, i) => (
            <section
              key={s.id}
              hidden={i !== step}
              aria-labelledby={`step-${s.id}`}
              className={
                direction === 'forward'
                  ? 'motion-safe:animate-step-in-forward'
                  : 'motion-safe:animate-step-in-back'
              }
            >
              <header className="mb-6">
                <h2
                  id={`step-${s.id}`}
                  ref={(el) => {
                    headingRefs.current[i] = el;
                  }}
                  tabIndex={-1}
                  className="text-title3 text-text-primary outline-none"
                >
                  {s.title}
                </h2>
                <p className="mt-1 text-callout text-text-secondary">{s.description}</p>
              </header>
              <div className="grid gap-5 sm:grid-cols-2">{content[s.id]}</div>
            </section>
          ))}
        </div>

        <div className="sticky bottom-0 z-10 rounded-b-card border-t border-border-subtle bg-surface-raised/95 px-5 py-4 backdrop-blur sm:px-8">
          {state.formError ? (
            <div className="mb-4">
              <Notice tone="error">{state.formError}</Notice>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            {step === 0 ? (
              <Link key="cancel" href="/angebote" className={buttonClass('ghost')}>
                Abbrechen
              </Link>
            ) : (
              <Button
                key="back"
                type="button"
                variant="secondary"
                onClick={() => goTo(step - 1)}
                disabled={pending}
              >
                <ArrowIcon direction="left" />
                Zurück
              </Button>
            )}

            {/* Eigene keys, damit React den Weiter-Button nicht zum Submit-Button umbaut,
                während der Klick noch läuft (sonst würde das Formular sofort abgeschickt). */}
            {isLast ? (
              <Button key="submit" type="submit" disabled={pending} className="min-w-44">
                {pending ? 'Wird veröffentlicht …' : 'Angebot veröffentlichen'}
              </Button>
            ) : (
              <Button key="next" type="button" onClick={goNext} className="min-w-32">
                Weiter
                <ArrowIcon direction="right" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </form>
  );
}
