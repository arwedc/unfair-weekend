import 'server-only';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { FUNCTION_ERROR_MESSAGES, UNKNOWN_ERROR_MESSAGE } from '@repo/shared';
import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

export type GeocodeResult = { ok: true; lat: number; lng: number } | { ok: false; message: string };

/** Adresse → Koordinaten über die Edge Function `geocode` (siehe docs/BACKEND.md). */
export async function geocode(
  supabase: Client,
  street: string,
  postalCode: string,
  city: string,
): Promise<GeocodeResult> {
  const { data, error } = await supabase.functions.invoke<{ lat: number; lng: number }>('geocode', {
    body: { street, postal_code: postalCode, city },
  });
  if (data && !error) return { ok: true, lat: data.lat, lng: data.lng };

  if (error instanceof FunctionsHttpError) {
    const body = (await (error.context as Response).json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    const code = body?.error?.code;
    if (code && code in FUNCTION_ERROR_MESSAGES) {
      return {
        ok: false,
        message: FUNCTION_ERROR_MESSAGES[code as keyof typeof FUNCTION_ERROR_MESSAGES],
      };
    }
    if (body?.error?.message) return { ok: false, message: body.error.message };
  }
  return { ok: false, message: `Adresse konnte nicht geprüft werden. ${UNKNOWN_ERROR_MESSAGE}` };
}
