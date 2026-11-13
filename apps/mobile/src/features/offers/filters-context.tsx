/** Filter für Feed und Karte. Beide Tabs teilen sich denselben Stand. */
import { createContext, use, useState, type ReactNode } from 'react';

import { EMPTY_FILTERS, type OfferFilters } from './feed-logic';

interface OfferFiltersContextValue {
  filters: OfferFilters;
  setFilters: (patch: Partial<OfferFilters>) => void;
  resetFilters: () => void;
}

const OfferFiltersContext = createContext<OfferFiltersContextValue | null>(null);

export function OfferFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<OfferFilters>(EMPTY_FILTERS);

  return (
    <OfferFiltersContext
      value={{
        filters,
        setFilters: (patch) => setState((current) => ({ ...current, ...patch })),
        resetFilters: () => setState(EMPTY_FILTERS),
      }}
    >
      {children}
    </OfferFiltersContext>
  );
}

export function useOfferFilters(): OfferFiltersContextValue {
  const value = use(OfferFiltersContext);
  if (!value) throw new Error('useOfferFilters braucht den OfferFiltersProvider im Root-Layout.');
  return value;
}
