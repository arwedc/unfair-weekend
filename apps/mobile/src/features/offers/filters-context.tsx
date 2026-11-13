/** Filter und Stadt für Feed und Karte. Beide Tabs teilen sich denselben Stand. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_CITY_ID, isCityId, type CityId } from './cities';
import { EMPTY_FILTERS, type OfferFilters } from './feed-logic';

/** Die gewählte Stadt bleibt über App-Starts hinweg erhalten. */
const CITY_STORAGE_KEY = 'unfair-weekend:stadt';

interface OfferFiltersContextValue {
  filters: OfferFilters;
  setFilters: (patch: Partial<OfferFilters>) => void;
  /** Setzt Zeit, Kategorie und Suche zurück. Die Stadt bleibt. */
  resetFilters: () => void;
  cityId: CityId;
  setCityId: (cityId: CityId) => void;
}

const OfferFiltersContext = createContext<OfferFiltersContextValue | null>(null);

export function OfferFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<OfferFilters>(EMPTY_FILTERS);
  const [cityId, setCityState] = useState<CityId>(DEFAULT_CITY_ID);
  // Wurde die Stadt schon gesetzt (Standort oder von Hand), darf die gespeicherte sie
  // nicht mehr überschreiben, falls sie erst danach geladen ist.
  const cityChosen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(CITY_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && !cityChosen.current && isCityId(stored)) setCityState(stored);
      })
      .catch(() => {
        // Ohne gespeicherte Stadt startet die App einfach in der Startstadt.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <OfferFiltersContext
      value={{
        filters,
        setFilters: (patch) => setState((current) => ({ ...current, ...patch })),
        resetFilters: () => setState(EMPTY_FILTERS),
        cityId,
        setCityId: (next) => {
          cityChosen.current = true;
          setCityState(next);
          AsyncStorage.setItem(CITY_STORAGE_KEY, next).catch(() => {
            // Nicht schlimm: Beim nächsten Start ist wieder die Startstadt gewählt.
          });
        },
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
