'use server';

import { revalidatePath } from 'next/cache';
import { parseRpcError } from '@repo/shared';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function validId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function approveLocationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const locationId = String(formData.get('location_id') ?? '');
  const mergeId = String(formData.get('merge_company_id') ?? '');
  if (formData.get('verified') !== 'on' || !validId(locationId) || (mergeId && !validId(mergeId)))
    return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_location', {
    p_location_id: locationId,
    ...(mergeId ? { p_merge_into_company_id: mergeId } : {}),
  });
  if (error) throw new Error(parseRpcError(error)?.message ?? 'Freischalten hat nicht geklappt.');
  revalidatePath('/admin');
}

export async function rejectLocationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const locationId = String(formData.get('location_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!validId(locationId) || reason.length < 3 || reason.length > 500) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('reject_location', {
    p_location_id: locationId,
    p_reason: reason,
  });
  if (error) throw new Error(parseRpcError(error)?.message ?? 'Ablehnen hat nicht geklappt.');
  revalidatePath('/admin');
}
