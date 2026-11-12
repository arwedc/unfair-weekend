/**
 * Supabase-Verbindung aus apps/web/.env.local. Beide Werte sind öffentlich (Publishable Key),
 * deshalb NEXT_PUBLIC_. Next.js ersetzt sie beim Build, auch im Browser-Code.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export function assertSupabaseEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlen in apps/web/.env.local.',
    );
  }
}
