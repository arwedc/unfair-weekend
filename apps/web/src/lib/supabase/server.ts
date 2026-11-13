import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { io } from 'next/cache';
import { cookies } from 'next/headers';
import type { Database } from '@repo/shared';
import { assertSupabaseEnv, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/**
 * Supabase-Client für Server Components und Server Actions, mit der Session aus den Cookies.
 * Pro Anfrage neu erzeugen, nie global teilen.
 */
export async function createClient() {
  // Erst cookies() lesen: macht die Seite dynamisch, damit der Build sie nicht vorab rendert.
  const cookieStore = await cookies();
  // Mit Partial Prefetching sind Cookies auch im Prefetch-Prerender (App Shell) verfügbar.
  // Supabase Auth liest Date.now() (Ablauf der Session), das darf dort nicht laufen.
  // io() schließt alles Folgende aus jedem Prerender aus, auch aus dem Prefetch.
  await io();
  assertSupabaseEnv();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components dürfen keine Cookies schreiben. Das Auffrischen übernimmt proxy.ts.
        }
      },
    },
  });
}
