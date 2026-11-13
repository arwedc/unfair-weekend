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
import { OFFER_CATEGORIES, OFFER_LIMITS } from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { Button, buttonClass, Card, Field, inputClass } from '@/components/ui';
import { Notice, TypePicker, type OfferType } from '@/components/offers/form-parts';
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
import { useT } from '@/lib/i18n/context';
import { addMinutesToBerlinInput, formatDuration } from '@/lib/templates/form';

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
  /**
   * Angebot aus einer Vorlage: Alles ist vorausgefüllt, es fehlt nur der Beginn.
   * Statt des Assistenten steht dann alles auf einer Seite, „Wann?“ zuerst.
   */
  template?: { name: string; durationMinutes: number };
}

/** Reihenfolge der Abschnitte, wenn das Angebot aus einer Vorlage kommt: die Zeit zuerst. */
const TEMPLATE_STEP_ORDER = [
  ...OFFER_STEPS.filter((s) => s.id === 'wann'),
  ...OFFER_STEPS.filter((s) => s.id !== 'wann'),
];

/**
 * Formular für Angebote. Beim Anlegen ein Assistent in vier Schritten
 * (Worum geht es? → Wann? → Preis und Plätze → Wo?), beim Bearbeiten und beim Anlegen
 * aus einer Vorlage alles auf einer Seite.
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
  template,
}: OfferFormProps) {
  const { locale, t, labels } = useT();
  const f = t.offers.form;
  const stepText = t.offers.steps;
  const [state, formAction, pending] = useActionState(action, {
    errors: {},
    values: initialValues,
  });
  const values = state.values ?? initialValues;
  const wizard = mode === 'create' && !template;
  const fromTemplate = mode === 'create' && template !== undefined;

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
  const [endsAt, setEndsAt] = useState(values.ends_at ?? '');

  /** Aus Vorlage: Das Ende folgt dem Beginn (Beginn + Dauer), bleibt aber änderbar. */
  function handleStartChange(value: string) {
    if (!template) return;
    const end = addMinutesToBerlinInput(value, template.durationMinutes);
    if (end) setEndsAt(end);
  }

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
    const found = validateStep(def.id, readFormValues(formRef.current), {
      minDiscountPercent,
      messages: t.offers.validation,
    });
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
    if (fromTemplate) {
      // Alles steht auf einer Seite: alle Abschnitte prüfen, erstes fehlerhaftes Feld fokussieren.
      const ok = OFFER_STEPS.map((_, i) => checkStep(i)).every(Boolean);
      if (!ok) {
        e.preventDefault();
        requestAnimationFrame(() => {
          formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        });
      }
      return;
    }
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
          label={f.title}
          hint={f.titleHint}
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
          label={f.description}
          hint={f.descriptionHint}
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
        <Field id="category" label={f.category} error={err('category')}>
          <select
            id="category"
            name="category"
            defaultValue={val('category') ?? ''}
            className={inputClass}
            {...aria('category')}
          >
            <option value="" disabled>
              {f.pleaseChoose}
            </option>
            {OFFER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labels.offerCategory[c]}
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
        <TypePicker value={type} onChange={setType} disabled={locked('type')} />
        <Field
          id="starts_at"
          label={type === 'einzeltermin' ? f.start : f.redeemFrom}
          error={err('starts_at')}
        >
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={val('starts_at')}
            onChange={(e) => handleStartChange(e.target.value)}
            disabled={locked('starts_at')}
            autoFocus={fromTemplate}
            className={inputClass}
            {...aria('starts_at')}
          />
        </Field>
        <Field
          id="ends_at"
          label={type === 'einzeltermin' ? f.end : f.redeemUntil}
          hint={
            template
              ? f.fromTemplateEnd(formatDuration(template.durationMinutes, locale))
              : f.timeHint(OFFER_LIMITS.maxDurationDays)
          }
          error={err('ends_at')}
        >
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            disabled={locked('ends_at')}
            className={inputClass}
            {...aria('ends_at')}
          />
        </Field>
      </>
    ),
    preis: (
      <>
        <Field id="original_price" label={f.originalPrice} error={err('original_price')}>
          <input
            id="original_price"
            name="original_price"
            inputMode="decimal"
            placeholder={f.pricePlaceholderOriginal}
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            disabled={locked('original_price')}
            className={inputClass}
            {...aria('original_price')}
          />
        </Field>
        <Field
          id="deal_price"
          label={f.dealPrice}
          hint={
            discount !== null ? (
              <span className={discountTooLow ? 'text-status-error-text' : 'text-text-accent'}>
                {f.discountLabel(formatDiscount(discount, locale))}
                {discountTooLow ? f.discountMin(minDiscountPercent) : ''}
              </span>
            ) : originalCents ? (
              f.discountBelow(minDiscountPercent, formatPrice(originalCents, { locale }))
            ) : (
              f.discountMinOnly(minDiscountPercent)
            )
          }
          error={err('deal_price')}
        >
          <input
            id="deal_price"
            name="deal_price"
            inputMode="decimal"
            placeholder={f.pricePlaceholderDeal}
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
              {formatDiscount(discount, locale)}
            </span>
            <p className="text-subhead text-accent-on-subtle">
              {f.savingsBefore}{' '}
              <span className="line-through">{formatPrice(originalCents, { locale })}</span>{' '}
              {f.savingsMiddle}{' '}
              <span className="font-semibold">{formatPrice(dealCents, { locale })}</span>
              {f.savingsAfter(formatPrice(originalCents - dealCents, { locale }))}
            </p>
          </div>
        ) : null}
        <Field
          id="capacity"
          label={f.capacity}
          hint={seatsTaken > 0 ? f.capacityTaken(seatsTaken) : undefined}
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
          label={f.maxPerUser}
          hint={f.maxPerUserHint}
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
          label={f.street}
          hint={mode === 'create' ? f.streetHint : undefined}
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
        <Field id="postal_code" label={f.postalCode} error={err('postal_code')}>
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
        <Field id="city" label={f.city} error={err('city')}>
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
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate
      >
        {template ? (
          <p className="rounded-card bg-accent-subtle px-4 py-3 text-subhead text-accent-on-subtle">
            {f.fromTemplate(template.name)}
          </p>
        ) : null}
        {hasCodes ? (
          <p className="rounded-card bg-accent-subtle px-4 py-3 text-subhead text-accent-on-subtle">
            {f.lockedNotice}
          </p>
        ) : null}

        {(fromTemplate ? TEMPLATE_STEP_ORDER : OFFER_STEPS).map((s) => (
          <section key={s.id} aria-labelledby={`step-${s.id}`}>
            <Card className="p-5 sm:p-6">
              <h2 id={`step-${s.id}`} className="mb-4 text-headline text-text-primary">
                {stepText[s.id].title}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">{content[s.id]}</div>
            </Card>
          </section>
        ))}

        {state.formError ? <Notice tone="error">{state.formError}</Notice> : null}
        {state.saved ? <Notice tone="success">{t.common.changesSaved}</Notice> : null}

        {fromTemplate ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/vorlagen"
              className={buttonClass(
                'ghost',
                'border border-border-default hover:border-border-strong',
              )}
            >
              {t.common.cancel}
            </Link>
            <Button type="submit" disabled={pending} className="min-w-44">
              {pending ? f.publishing : f.publish}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? t.common.saving : t.common.saveChanges}
            </Button>
          </div>
        )}
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
          <StepProgress
            steps={OFFER_STEPS.map((s) => ({ id: s.id, title: stepText[s.id].title }))}
            current={step}
            reached={reached}
            onSelect={goTo}
          />
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
                  {stepText[s.id].title}
                </h2>
                <p className="mt-1 text-callout text-text-secondary">
                  {stepText[s.id].description}
                </p>
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
              <Link
                key="cancel"
                href="/angebote"
                className={buttonClass(
                  'ghost',
                  'border border-border-default hover:border-border-strong',
                )}
              >
                {t.common.cancel}
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
                {t.common.back}
              </Button>
            )}

            {/* Eigene keys, damit React den Weiter-Button nicht zum Submit-Button umbaut,
                während der Klick noch läuft (sonst würde das Formular sofort abgeschickt). */}
            {isLast ? (
              <Button key="submit" type="submit" disabled={pending} className="min-w-44">
                {pending ? f.publishing : f.publish}
              </Button>
            ) : (
              <Button key="next" type="button" onClick={goNext} className="min-w-32">
                {t.common.next}
                <ArrowIcon direction="right" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </form>
  );
}
