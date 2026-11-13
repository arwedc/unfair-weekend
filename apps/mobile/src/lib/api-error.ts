import { parseRpcError } from '@repo/shared';

import { getLocale } from '@/lib/i18n/locale-store';
import { getMessages } from '@/lib/i18n/messages';

/** Fehler mit festem Code und fertigem Text (in der gewählten Sprache) für die Oberfläche. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface SupabaseLikeError {
  message?: string | null;
  details?: string | null;
}

/** Wandelt einen Supabase-Fehler in einen ApiError um (Codes und Texte aus @repo/shared). */
export function toApiError(error: SupabaseLikeError): ApiError {
  const locale = getLocale();
  const t = getMessages(locale).common;
  const raw = `${error.message ?? ''} ${error.details ?? ''}`;
  if (/network request failed|failed to fetch|fetch failed/i.test(raw)) {
    return new ApiError('OFFLINE', t.offline);
  }
  const parsed = parseRpcError(error, locale);
  return new ApiError(parsed?.code ?? 'UNBEKANNT', parsed?.message ?? t.unknownError);
}

/** Text für die Oberfläche, egal was geworfen wurde. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return toApiError({ message: error instanceof Error ? error.message : String(error) }).message;
}

export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'OFFLINE';
}
