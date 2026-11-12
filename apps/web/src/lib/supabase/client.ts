import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@repo/shared';
import { assertSupabaseEnv, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/** Supabase-Client im Browser (nutzt dieselbe Session wie der Server, über Cookies). */
export function createClient() {
  assertSupabaseEnv();
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
