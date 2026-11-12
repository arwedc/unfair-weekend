/**
 * Edge Function „geocode“: Adresse → Koordinaten (lat/lng)
 *
 * Für Standort-Accounts und Admins (Formular „Angebot anlegen“ bzw. Registrierung).
 * Geocoder: Nominatim, bei Fehlern Photon (beide OpenStreetMap). Ergebnis wird in
 * public.geocode_cache gespeichert, damit die Dienste
 * pro Adresse nur einmal gefragt werden (Nutzungsrichtlinien: wenige Anfragen, kein Massenabruf).
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

interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
  provider: 'nominatim' | 'photon';
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    countrycode?: string;
  };
}

/** Nominatim (strukturierte Suche). Wirft bei HTTP-Fehlern, null = nicht gefunden. */
async function geocodeNominatim(
  street: string,
  postalCode: string,
  city: string,
): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'de');
  url.searchParams.set('street', street);
  url.searchParams.set('postalcode', postalCode);
  url.searchParams.set('city', city);
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de' },
  });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const hit = ((await response.json()) as NominatimHit[])[0];
  return hit
    ? {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        display_name: hit.display_name,
        provider: 'nominatim',
      }
    : null;
}

/** Photon (komoot). Nur Treffer in Deutschland mit passender PLZ. */
async function geocodePhoton(
  street: string,
  postalCode: string,
  city: string,
): Promise<GeocodeResult | null> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', `${street}, ${postalCode} ${city}`);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lang', 'de');
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);
  const { features } = (await response.json()) as { features: PhotonFeature[] };
  const hit = features.find(
    (f) => f.properties.countrycode === 'DE' && f.properties.postcode === postalCode,
  );
  if (!hit) return null;
  const p = hit.properties;
  const line1 = [p.street ?? p.name, p.housenumber].filter(Boolean).join(' ');
  return {
    lat: hit.geometry.coordinates[1],
    lng: hit.geometry.coordinates[0],
    display_name: [line1, `${p.postcode ?? ''} ${p.city ?? ''}`.trim()].filter(Boolean).join(', '),
    provider: 'photon',
  };
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

    // Erst Nominatim, bei Fehler (z. B. 403 für Cloud-IPs) Photon. Beide nutzen OSM-Daten.
    let found: GeocodeResult | null;
    try {
      found = await geocodeNominatim(street, postalCode, city);
    } catch (nominatimError) {
      console.warn('geocode: Nominatim nicht nutzbar, versuche Photon', String(nominatimError));
      try {
        found = await geocodePhoton(street, postalCode, city);
      } catch (photonError) {
        console.error('geocode: kein Geocoder erreichbar', String(photonError));
        return fail(
          502,
          'GEOCODING_NICHT_VERFUEGBAR',
          'Der Kartendienst ist gerade nicht erreichbar.',
        );
      }
    }

    if (!found) {
      return fail(404, 'ADRESSE_NICHT_GEFUNDEN', 'Diese Adresse wurde nicht gefunden.');
    }

    const { provider, ...result } = found;
    const { error: cacheError } = await ctx.supabaseAdmin
      .from('geocode_cache')
      .upsert({ query: cacheKey, ...result, provider });
    if (cacheError) console.error('geocode: Cache-Fehler', cacheError.message);

    return Response.json({ ...result, cached: false });
  }),
};
