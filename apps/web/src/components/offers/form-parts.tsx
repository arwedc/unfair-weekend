import type { ReactNode } from 'react';
import { OFFER_TYPE_LABELS, OFFER_TYPES, type Enums } from '@repo/shared';

export type OfferType = Enums<'offer_type'>;

const TYPE_HINTS: Record<OfferType, string> = {
  einzeltermin: 'Ein fester Termin, z. B. ein Kochkurs am Freitagabend.',
  zeitraum: 'Einlösbar in einem Zeitraum, z. B. eine Massage bis Sonntag.',
};

/** Hinweisbox für Fehler oder Erfolg in Formularen. */
export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
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

/** Auswahl Einzeltermin/Zeitraum als zwei Karten (Radio-Feld `type`). */
export function TypePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: OfferType;
  onChange: (type: OfferType) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="sm:col-span-2" disabled={disabled}>
      <legend className="mb-1.5 text-subhead text-text-primary">Art des Angebots</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OFFER_TYPES.map((t) => (
          <label
            key={t}
            className={`relative rounded-input border p-4 transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-focus ${
              value === t
                ? 'border-accent-vivid bg-accent-subtle'
                : 'border-border-default bg-surface-default hover:border-border-strong'
            } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            <input
              type="radio"
              name="type"
              value={t}
              checked={value === t}
              onChange={() => onChange(t)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                value === t ? 'border-accent-solid' : 'border-border-strong'
              }`}
            >
              {value === t ? <span className="h-2.5 w-2.5 rounded-full bg-accent-solid" /> : null}
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
  );
}
