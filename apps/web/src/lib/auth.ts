import 'server-only';
import { redirect } from 'next/navigation';
import type { Enums } from '@repo/shared';
import { loginUrl } from '@/lib/safe-redirect';
import { createClient } from '@/lib/supabase/server';

/** Standort aus `get_my_account().location` (siehe docs/BACKEND.md). */
export interface PortalLocation {
  id: string;
  name: string;
  status: Enums<'location_status'>;
  status_reason: string | null;
  company_id: string;
  company_name: string;
}

export interface PortalAccount {
  userId: string;
  location: PortalLocation;
}

export interface MyAccountJson {
  user_id: string;
  role: Enums<'app_role'>;
  location: PortalLocation | null;
}

/** Angemeldetes Konto mit Rolle und (falls vorhanden) Standort, sonst `null`. */
export async function getMyAccount(): Promise<MyAccountJson | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;

  const { data, error } = await supabase.rpc('get_my_account');
  if (error || !data) return null;
  return data as unknown as MyAccountJson;
}

/**
 * Angemeldeter Standort-Account oder `null`.
 * Nutzer- und Admin-Konten ohne Standort zählen hier nicht als angemeldet.
 */
export async function getAccount(): Promise<PortalAccount | null> {
  const account = await getMyAccount();
  if (!account?.location) return null;
  return { userId: account.user_id, location: account.location };
}

/**
 * Für Seiten im Portal: ohne Standort-Account zurück zum Login.
 * `next` ist die Seite, auf die es nach dem Login zurückgeht (z. B. ein gescannter QR-Link).
 * Standorte, die noch nicht freigeschaltet sind, sehen statt des Portals ihren Antragsstatus.
 */
export async function requireAccount(next?: string): Promise<PortalAccount> {
  const account = await getAccount();
  if (!account) redirect(loginUrl(next, 'kein-standort'));
  if (account.location.status !== 'approved') redirect('/antrag');
  return account;
}

/** Für Admin-Seiten und -Actions. Die Rolle kommt frisch aus der DB. */
export async function requireAdmin(): Promise<void> {
  const account = await getMyAccount();
  if (account?.role !== 'admin') redirect(loginUrl(null, 'kein-admin'));
}
