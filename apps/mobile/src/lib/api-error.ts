import { parseRpcError } from '@repo/shared';

/** Fehler mit festem Code und fertigem deutschen Text für die Oberfläche. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const OFFLINE_MESSAGE = 'Keine Verbindung. Prüf dein Internet und versuch es nochmal.';

interface SupabaseLikeError {
  message?: string | null;
  details?: string | null;
}

/** Wandelt einen Supabase-Fehler in einen ApiError um (Codes und Texte aus @repo/shared). */
export function toApiError(error: SupabaseLikeError): ApiError {
  const raw = `${error.message ?? ''} ${error.details ?? ''}`;
  if (/network request failed|failed to fetch|fetch failed/i.test(raw)) {
    return new ApiError('OFFLINE', OFFLINE_MESSAGE);
  }
  const parsed = parseRpcError(error);
  return new ApiError(parsed?.code ?? 'UNBEKANNT', parsed?.message ?? 'Etwas ist schiefgelaufen.');
}

/** Text für die Oberfläche, egal was geworfen wurde. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return toApiError({ message: error instanceof Error ? error.message : String(error) }).message;
}

export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'OFFLINE';
}
