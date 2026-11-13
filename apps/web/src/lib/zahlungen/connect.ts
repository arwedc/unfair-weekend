import 'server-only';
import {
  FUNCTION_ERROR_MESSAGES,
  RPC_ERROR_MESSAGES,
  UNKNOWN_ERROR_MESSAGE,
  isRpcErrorCode,
} from '@repo/shared';
import { createClient } from '@/lib/supabase/server';

type ConnectRequest =
  | { action: 'onboarding'; return_url: string; refresh_url: string }
  | { action: 'dashboard' }
  | { action: 'status' };

interface ConnectResponse {
  url?: string;
  error?: { code?: string };
}

function errorMessage(code: string | undefined): string {
  if (!code) return UNKNOWN_ERROR_MESSAGE;
  if (isRpcErrorCode(code)) return RPC_ERROR_MESSAGES[code];
  if (Object.hasOwn(FUNCTION_ERROR_MESSAGES, code)) {
    return FUNCTION_ERROR_MESSAGES[code as keyof typeof FUNCTION_ERROR_MESSAGES];
  }
  return UNKNOWN_ERROR_MESSAGE;
}

/** Ruft die Connect-Function mit der aktuellen Standort-Session auf. */
export async function invokeConnect(request: ConnectRequest): Promise<{
  result: ConnectResponse | null;
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding', {
    body: request,
  });
  let result = data as ConnectResponse | null;

  if (error && !result?.error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      result = (await context
        .clone()
        .json()
        .catch(() => null)) as ConnectResponse | null;
    }
  }

  if (error || result?.error) return { result, error: errorMessage(result?.error?.code) };
  return { result };
}

export function paymentReturnUrls() {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return {
    return_url: `${origin}/auszahlungen?zurueck=1`,
    refresh_url: `${origin}/auszahlungen?neu=1`,
  };
}
