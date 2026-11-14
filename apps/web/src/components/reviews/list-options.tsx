'use client';

import { useRouter } from 'next/navigation';
import { createContext, use, useOptimistic, useTransition, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/context';
import {
  REVIEW_PERIOD_DAYS,
  REVIEW_SORTS,
  reviewsHref,
  type ReviewFilters,
} from '@/lib/reviews/filters';

/**
 * Sortierung und Zeitraum der Bewertungsliste.
 *
 * Eine Auswahl wechselt sofort die URL (ohne Neuladen der Seite). Bis die neuen Daten da
 * sind, bleibt die alte Liste stehen und wird über <ReviewsPending> leicht ausgegraut.
 * Neue Auswahlfelder kommen hier dazu und rufen `navigate({ … })` auf.
 */

interface ReviewsNavigation {
  filters: ReviewFilters;
  isPending: boolean;
  navigate: (changes: Partial<ReviewFilters>) => void;
}

const ReviewsNavigationContext = createContext<ReviewsNavigation | null>(null);

function useReviewsNavigation(): ReviewsNavigation {
  const value = use(ReviewsNavigationContext);
  if (!value) throw new Error('ReviewsNavigationProvider fehlt.');
  return value;
}

export function ReviewsNavigationProvider({
  filters,
  children,
}: {
  filters: ReviewFilters;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Zeigt die neue Auswahl sofort an, bis der Server die passende Seite geliefert hat.
  const [optimistic, setOptimistic] = useOptimistic(filters);

  const navigate = (changes: Partial<ReviewFilters>) => {
    const next: ReviewFilters = { ...optimistic, page: 1, ...changes };
    startTransition(() => {
      setOptimistic(next);
      router.push(reviewsHref(next), { scroll: false });
    });
  };

  return (
    <ReviewsNavigationContext value={{ filters: optimistic, isPending, navigate }}>
      {children}
    </ReviewsNavigationContext>
  );
}

/** Graut den Inhalt aus, solange eine neue Auswahl lädt. */
export function ReviewsPending({ children }: { children: ReactNode }) {
  const { isPending } = useReviewsNavigation();
  return (
    <div
      aria-busy={isPending}
      className={`transition-opacity duration-150 ${isPending ? 'opacity-50' : ''}`}
    >
      {children}
    </div>
  );
}

const selectClass =
  'mt-1 block min-h-11 rounded-input border border-border-default bg-surface-default px-3 text-body text-text-primary';

export function ReviewListOptions() {
  const { t } = useT();
  const r = t.reviews;
  const { filters, navigate } = useReviewsNavigation();

  return (
    <div role="group" aria-label={r.listOptions} className="flex flex-wrap items-end gap-2">
      <label className="text-footnote text-text-secondary">
        {r.sortLabel}
        <select
          value={filters.sort}
          onChange={(event) => {
            const sort = REVIEW_SORTS.find((value) => value === event.target.value);
            if (sort) navigate({ sort });
          }}
          className={selectClass}
        >
          {REVIEW_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {r.sortOptions[sort]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-footnote text-text-secondary">
        {r.periodLabel}
        <select
          value={filters.period ?? ''}
          onChange={(event) => {
            const period = REVIEW_PERIOD_DAYS.find((days) => String(days) === event.target.value);
            navigate({ period });
          }}
          className={selectClass}
        >
          <option value="">{r.periodAll}</option>
          {REVIEW_PERIOD_DAYS.map((days) => (
            <option key={days} value={days}>
              {r.periodOption(days)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
