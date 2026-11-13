import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OfferTemplate } from '@/lib/templates/form';

/** Vorlagen des eigenen Standorts (RLS liefert nur diese), nach Name sortiert. */
export async function listMyTemplates(): Promise<OfferTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('offer_templates').select('*').order('name');
  if (error) throw new Error(`Vorlagen konnten nicht geladen werden: ${error.message}`);
  return data;
}

export async function getMyTemplate(id: string): Promise<OfferTemplate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('offer_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return data;
}
