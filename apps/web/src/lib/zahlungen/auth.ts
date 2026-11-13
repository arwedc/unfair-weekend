import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Admin-Prüfung für Seiten und Server Actions. Das Rollenrecht kommt frisch aus der DB. */
export async function requirePaymentAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_my_account');
  const account = data as unknown as { role?: string } | null;

  if (error || account?.role !== 'admin') redirect('/login?grund=kein-admin');
  return supabase;
}
