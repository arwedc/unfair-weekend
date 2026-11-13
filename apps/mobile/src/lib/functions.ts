/**
 * Edge Functions aufrufen. Antwort bei Fehlern: `{ error: { code, message } }`.
 * Die Codes sind RPC-Codes (z. B. AUSGEBUCHT) oder eigene der Functions
 * (z. B. STRIPE_NICHT_ERREICHBAR). Texte kommen immer aus @repo/shared.
 */
import { getErrorMessages, isRpcErrorCode, type FunctionErrorCode } from '@repo/shared';

import { ApiError, toApiError } from '@/lib/api-error';
import { getLocale } from '@/lib/i18n/locale-store';
import { supabase } from '@/lib/supabase';

interface FunctionErrorBody {
  error?: { code?: string; message?: string };
}

function functionError(code: string | undefined, fallback: unknown): ApiError {
  const messages = getErrorMessages(getLocale());
  if (code && isRpcErrorCode(code)) return new ApiError(code, messages.rpc[code]);
  if (code && Object.prototype.hasOwnProperty.call(messages.functions, code)) {
    return new ApiError(code, messages.functions[code as FunctionErrorCode]);
  }
  return toApiError({ message: fallback instanceof Error ? fallback.message : String(fallback) });
}

export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const response = await supabase.functions.invoke<T & FunctionErrorBody>(name, { body });
  const data: (T & FunctionErrorBody) | null = response.data;
  const error: unknown = response.error;
  if (!error && data && !data.error) return data;

  let payload: FunctionErrorBody | null = data ?? null;
  const context = (error as { context?: unknown } | null)?.context;
  if (!payload?.error && context instanceof Response) {
    payload = (await context
      .clone()
      .json()
      .catch(() => null)) as FunctionErrorBody | null;
  }
  throw functionError(payload?.error?.code, error ?? payload?.error?.message);
}
