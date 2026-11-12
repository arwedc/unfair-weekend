import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api-error';

/** Ein QueryClient für die ganze App. Angebote ändern sich oft (Plätze), deshalb kurze Frische. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Fachliche Fehler (feste Codes) nicht wiederholen, nur Verbindungsprobleme.
      retry: (failureCount, error) =>
        failureCount < 2 && error instanceof ApiError && error.code === 'OFFLINE',
    },
  },
});
