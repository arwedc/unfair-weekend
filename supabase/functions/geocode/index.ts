/**
 * Edge Function „geocode“: Adresse → Koordinaten (lat/lng)
 *
 * Für Standort-Accounts und Admins (Formular „Angebot anlegen“ bzw. Registrierung).
 * Ergebnis wird in public.geocode_cache gespeichert, damit Nominatim (OpenStreetMap)
 * pro Adresse nur einmal gefragt wird (Nutzungsrichtlinie: max. 1 Anfrage/Sekunde).
 *
 * Aufruf (supabase-js, angemeldet):
 *   const { data, error } = await supabase.functions.invoke('geocode', {
 *     body: { street: 'Prinzipalmarkt 1', postal_code: '48143', city: 'Münster' },
 *   });
 *   // data = { lat: 51.96, lng: 7.62, display_name: '…', cached: false }
 *
 * Fehler: { error: { code, message } } mit HTTP 400/403/404/502.
 * Deploy (ohne Docker): pnpm supabase functions deploy geocode --use-api
 */
import { withSupabase } from 'npm:@supabase/server@1.9.2';

interface GeocodeBody {
  street?: unknown;
  postal_code?: unknown;
  city?: unknown;
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
}

const USER_AGENT = 'unfair-weekend/0.1 (+https://github.com/arwedc/unfair-weekend)';

function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return fail(405, 'UNGUELTIGE_EINGABE', 'Bitte per POST aufrufen.');
    }

    // Nur Standort-Accounts und Admins
    const userId = ctx.userClaims?.id;
    const { data: profile } = await ctx.supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId ?? '')
      .maybeSingle();
    if (!profile || (profile.role !== 'standort' && profile.role !== 'admin')) {
      return fail(403, 'KEIN_ZUGRIFF', 'Nur für Standort-Accounts.');
    }

    const body = (await req.json().catch(() => ({}))) as GeocodeBody;
    const street = asText(body.street, 120);
    const postalCode = asText(body.postal_code, 10);
    const city = asText(body.city, 80);
    if (!street || !postalCode || !/^[0-9]{5}$/.test(postalCode) || !city) {
      return fail(400, 'UNGUELTIGE_EINGABE', 'Bitte Straße, 5-stellige PLZ und Ort angeben.');
    }

    const query = `${street}, ${postalCode} ${city}, Deutschland`;
    const cacheKey = query.toLowerCase();

    const { data: cached } = await ctx.supabaseAdmin
      .from('geocode_cache')
      .select('lat, lng, display_name')
      .eq('query', cacheKey)
      .maybeSingle();
    if (cached) {
      return Response.json({ ...cached, cached: true });
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'de');
    url.searchParams.set('street', street);
    url.searchParams.set('postalcode', postalCode);
    url.searchParams.set('city', city);

    let hits: NominatimHit[];
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de' },
      });
      if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
      hits = (await response.json()) as NominatimHit[];
    } catch (error) {
      console.error('geocode: Nominatim nicht erreichbar', error);
      return fail(
        502,
        'GEOCODING_NICHT_VERFUEGBAR',
        'Der Kartendienst ist gerade nicht erreichbar.',
      );
    }

    const hit = hits[0];
    if (!hit) {
      return fail(404, 'ADRESSE_NICHT_GEFUNDEN', 'Diese Adresse wurde nicht gefunden.');
    }

    const result = { lat: Number(hit.lat), lng: Number(hit.lon), display_name: hit.display_name };
    const { error: cacheError } = await ctx.supabaseAdmin
      .from('geocode_cache')
      .upsert({ query: cacheKey, ...result, provider: 'nominatim' });
    if (cacheError) console.error('geocode: Cache-Fehler', cacheError.message);

    return Response.json({ ...result, cached: false });
  }),
};
