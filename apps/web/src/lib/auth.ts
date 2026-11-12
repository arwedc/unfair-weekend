import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocation, type Location } from '@/lib/mock/data';
import { SESSION_COOKIE } from '@/lib/session-cookie';

/*
 * MOCK-Anmeldung: Das Cookie enthält nur die Standort-ID, ohne Signatur.
 * Wird durch Supabase Auth (E-Mail + Passwort) ersetzt. Nicht produktiv nutzen.
 */

export async function getSession(): Promise<Location | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? getLocation(id) : null;
}

/** Für Seiten und Server Actions: angemeldeter Standort oder Umleitung zum Login. */
export async function requireSession(): Promise<Location> {
  const location = await getSession();
  if (!location) redirect('/login');
  return location;
}

export async function startSession(locationId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, locationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
