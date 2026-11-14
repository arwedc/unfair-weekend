import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@repo/shared';
import { accountHome, type AccountRouting } from '@/lib/account-home';
import { loginUrl, NEXT_PARAM, safeNext } from '@/lib/safe-redirect';
import { assertSupabaseEnv, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/env';

/**
 * Frischt bei jeder Anfrage die Supabase-Session auf (Token-Refresh über Cookies)
 * und schickt Nicht-Angemeldete aus dem Portal zum Login.
 * Die eigentliche Rechteprüfung machen die RPCs in der Datenbank.
 */
export async function proxy(request: NextRequest) {
  // Klare Meldung statt der englischen Supabase-Fehlermeldung, wenn .env.local fehlt.
  assertSupabaseEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Antworten mit Auth-Cookies dürfen nicht zwischengespeichert werden.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Nicht entfernen: löst den Refresh aus. getClaims prüft die Signatur des Tokens.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  const protectedPath =
    path.startsWith('/angebote') ||
    path.startsWith('/einloesen') ||
    path.startsWith('/bewertungen') ||
    path.startsWith('/auszahlungen') ||
    path.startsWith('/admin') ||
    path.startsWith('/registrieren') ||
    path.startsWith('/antrag');
  if (!signedIn && protectedPath) {
    // Nach dem Login zurück auf dieselbe Seite (wichtig für gescannte QR-Links).
    const target = loginUrl(path + request.nextUrl.search);
    return redirectKeepingCookies(new URL(target, request.url), response);
  }
  if (signedIn && path === '/login') {
    // Rollen stehen nicht im JWT. Der DB-Vertrag liefert die aktuelle Rolle fürs Login-Routing;
    // die Zielseiten prüfen sie selbst erneut.
    const { data: accountData, error } = await supabase.rpc('get_my_account');
    const home = error ? null : accountHome(accountData as unknown as AccountRouting | null);
    // Nutzerkonten ohne Ziel bleiben auf /login; die Login-Action meldet sie ab.
    if (home) {
      const next = safeNext(request.nextUrl.searchParams.get(NEXT_PARAM));
      const destination = home === '/angebote' && next ? next : home;
      return redirectKeepingCookies(new URL(destination, request.url), response);
    }
  }
  return response;
}

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const key of ['cache-control', 'expires', 'pragma']) {
    const value = from.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}

export const config = {
  matcher: [
    '/angebote/:path*',
    '/einloesen/:path*',
    '/bewertungen/:path*',
    '/auszahlungen/:path*',
    '/admin/:path*',
    '/registrieren',
    '/antrag',
    '/login',
  ],
};
