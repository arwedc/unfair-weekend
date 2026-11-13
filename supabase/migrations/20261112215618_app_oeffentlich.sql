-- ============================================================================
-- Öffentliche Daten für die App: Standortseite, Favoritenliste und „Neu dabei“
--
-- Die Tabellen locations, companies und offers sind für anon und Nutzer per RLS
-- nicht lesbar. Diese beiden RPCs geben nur das heraus, was ohnehin öffentlich
-- ist (freigeschaltete Standorte, holbare Angebote). Bestehende RPCs bleiben
-- unverändert.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_locations_public: freigeschaltete Standorte mit Unternehmensinfo
-- Für die Standortseite (eine ID) und die Liste der Lieblingsorte (mehrere IDs).
-- Nicht freigeschaltete oder unbekannte IDs fehlen einfach im Ergebnis.
-- ----------------------------------------------------------------------------
create function public.get_locations_public(p_location_ids uuid[])
returns table (
  id uuid,
  name text,
  street text,
  postal_code text,
  city text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  company_id uuid,
  company_name text,
  company_description text,
  company_logo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id, l.name, l.street, l.postal_code, l.city, l.lat, l.lng, l.phone, l.website,
    c.id, c.name, c.description, c.logo_path
  from public.locations l
  join public.companies c on c.id = l.company_id
  where l.status = 'approved'
    -- höchstens 100 IDs pro Aufruf
    and l.id = any ((coalesce(p_location_ids, '{}'::uuid[]))[1:100])
  order by l.name, l.id;
$$;

comment on function public.get_locations_public is
  'Freigeschaltete Standorte mit Unternehmensinfo zu den übergebenen IDs (max. 100). Auch ohne Login. Für Standortseite und Lieblingsorte der App.';

-- ----------------------------------------------------------------------------
-- list_offer_created_at: Veröffentlichungszeit holbarer Angebote
-- Für den Abschnitt „Neu dabei“. Gleiche Sichtbarkeit wie list_offers.
-- ----------------------------------------------------------------------------
create function public.list_offer_created_at(p_offer_ids uuid[])
returns table (
  id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.created_at
  from public.offers o
  join private.offer_feed f on f.id = o.id
  where f.is_claimable
    -- höchstens 100 IDs pro Aufruf (so viele liefert list_offers pro Seite)
    and o.id = any ((coalesce(p_offer_ids, '{}'::uuid[]))[1:100])
  order by o.created_at desc, o.id;
$$;

comment on function public.list_offer_created_at is
  'Veröffentlichungszeit (created_at) zu holbaren Angeboten aus list_offers, neueste zuerst (max. 100 IDs). Auch ohne Login. Für „Neu dabei“ in der App.';

-- ----------------------------------------------------------------------------
-- Rechte
-- ----------------------------------------------------------------------------
revoke all on function public.get_locations_public(uuid[]) from public;
revoke all on function public.list_offer_created_at(uuid[]) from public;

grant execute on function public.get_locations_public(uuid[]) to anon, authenticated;
grant execute on function public.list_offer_created_at(uuid[]) to anon, authenticated;
