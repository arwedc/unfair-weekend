'use client';

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className="h-3.5 w-3.5">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Fortschritt im Angebots-Assistenten: Balken plus nummerierte Schritte.
 * Schon erreichte Schritte lassen sich direkt anklicken.
 */
export function StepProgress({
  steps,
  current,
  reached,
  onSelect,
}: {
  steps: readonly { id: string; title: string }[];
  current: number;
  /** Höchster Schritt, der schon erreicht wurde. */
  reached: number;
  onSelect: (index: number) => void;
}) {
  const total = steps.length;
  const percent = Math.round(((current + 1) / total) * 100);
  const remaining = total - current - 1;
  const currentTitle = steps[current]?.title ?? '';

  return (
    <nav aria-label="Fortschritt">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-footnote font-semibold uppercase tracking-wider text-text-accent">
          Schritt {current + 1} von {total}
        </p>
        <p className="text-footnote text-text-tertiary">
          {remaining === 0
            ? 'Letzter Schritt'
            : `Noch ${remaining} ${remaining === 1 ? 'Schritt' : 'Schritte'}`}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-valuetext={`Schritt ${current + 1} von ${total}: ${currentTitle}`}
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-background-muted"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-accent-vivid to-accent-solid transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const selectable = i <= reached && !active;
          return (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={!selectable}
                aria-current={active ? 'step' : undefined}
                aria-label={`Schritt ${i + 1}: ${s.title}${done ? ' (erledigt)' : ''}`}
                className="group flex w-full min-w-0 items-center gap-2 rounded-input py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus enabled:cursor-pointer disabled:cursor-default"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-footnote font-semibold transition-colors duration-200 ${
                    done
                      ? 'bg-accent-solid text-accent-on-solid group-enabled:group-hover:bg-accent-solid-pressed'
                      : active
                        ? 'bg-accent-subtle text-text-accent ring-2 ring-accent-vivid'
                        : i <= reached
                          ? 'border border-accent-vivid text-text-accent group-hover:bg-accent-subtle'
                          : 'border border-border-default text-text-tertiary'
                  }`}
                >
                  {done ? <CheckIcon /> : i + 1}
                </span>
                <span
                  className={`hidden truncate text-subhead sm:block ${
                    active
                      ? 'text-text-primary'
                      : i <= reached
                        ? 'text-text-secondary group-enabled:group-hover:text-text-primary'
                        : 'text-text-tertiary'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
