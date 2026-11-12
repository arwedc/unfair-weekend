import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Company } from './form';

/** Eigenes Unternehmen (RLS: nur das eigene bzw. als Admin alle). */
export async function getMyCompany(companyId: string): Promise<Company | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, description, logo_path')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(`Unternehmen konnte nicht geladen werden: ${error.message}`);
  return data;
}
