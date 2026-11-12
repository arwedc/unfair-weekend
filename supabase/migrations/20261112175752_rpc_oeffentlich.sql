-- ============================================================================
-- Öffentliche RPCs (anon + authenticated): Feed, Detail, Aufrufe, Einstellungen
-- ============================================================================

-- Interne Sicht: Angebot + Standort + Unternehmen + berechnete Felder.
-- Liegt in private (nicht über die API erreichbar), nur für die RPCs.
create view private.offer_feed as
select
  o.id,
  o.title,
  o.description,
  o.category,
  o.image_paths,
  o.image_paths[1] as cover_image_path,
  o.original_price_cents,
  o.deal_price_cents,
  -- abgerundete Prozent, gleiche Regel wie discountPercent() in packages/shared
  ((o.original_price_cents - o.deal_price_cents) * 100 / o.original_price_cents)::integer as discount_percent,
  o.type,
  o.starts_at,
  o.ends_at,
  o.relevant_at,
  o.capacity,
  (o.capacity - o.seats_taken)::integer as free_seats,
  o.max_per_user,
  o.address,
  o.lat,
  o.lng,
  o.status,
  o.status_reason,
  o.location_id,
  l.name as location_name,
  l.street as location_street,
  l.postal_code as location_postal_code,
  l.city as location_city,
  l.phone as location_phone,
  l.website as location_website,
  l.status as location_status,
  c.id as company_id,
  c.name as company_name,
  c.description as company_description,
  c.logo_path as company_logo_path,
  -- Kann man den Code gerade holen? (ohne Platz-/Nutzerprüfung)
  (
    o.status = 'aktiv'
    and l.status = 'approved'
    and case when o.type = 'einzeltermin' then o.starts_at > now() else o.ends_at > now() end
  ) as is_claimable
from public.offers o
join public.locations l on l.id = o.location_id
join public.companies c on c.id = l.company_id;

revoke all on private.offer_feed from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- list_offers: Feed der aktuell holbaren Angebote, „als Nächstes relevant“ zuerst
-- ----------------------------------------------------------------------------
create function public.list_offers(
  p_category public.offer_category default null,
  p_location_ids uuid[] default null,
  p_only_available boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  category public.offer_category,
  cover_image_path text,
  image_paths text[],
  original_price_cents integer,
  deal_price_cents integer,
  discount_percent integer,
  type public.offer_type,
  starts_at timestamptz,
  ends_at timestamptz,
  relevant_at timestamptz,
  capacity integer,
  free_seats integer,
  max_per_user integer,
  address text,
  lat double precision,
  lng double precision,
  location_id uuid,
  location_name text,
  company_id uuid,
  company_name text,
  company_logo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.id, f.title, f.category, f.cover_image_path, f.image_paths,
    f.original_price_cents, f.deal_price_cents, f.discount_percent,
    f.type, f.starts_at, f.ends_at, f.relevant_at,
    f.capacity, f.free_seats, f.max_per_user,
    f.address, f.lat, f.lng,
    f.location_id, f.location_name, f.company_id, f.company_name, f.company_logo_path
  from private.offer_feed f
  where f.is_claimable
    and (p_category is null or f.category = p_category)
    and (p_location_ids is null or f.location_id = any (p_location_ids))
    and (not coalesce(p_only_available, false) or f.free_seats > 0)
  order by f.relevant_at, f.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

comment on function public.list_offers is
  'Feed: aktive, holbare Angebote freigeschalteter Standorte, sortiert nach relevant_at (Einzeltermin: Start, Zeitraum: Ende). Filter: Kategorie, Standorte, nur mit freien Plätzen. Max. 100 pro Seite.';

-- ----------------------------------------------------------------------------
-- get_offer: Detailansicht eines Angebots
-- Sichtbar, wenn öffentlich aktiv, oder für den eigenen Standort, Admins und
-- Nutzer, die einen Code dafür haben (z. B. nach einer Absage).
-- ----------------------------------------------------------------------------
create function public.get_offer(p_offer_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  category public.offer_category,
  cover_image_path text,
  image_paths text[],
  original_price_cents integer,
  deal_price_cents integer,
  discount_percent integer,
  type public.offer_type,
  starts_at timestamptz,
  ends_at timestamptz,
  relevant_at timestamptz,
  capacity integer,
  free_seats integer,
  max_per_user integer,
  address text,
  lat double precision,
  lng double precision,
  status public.offer_status,
  status_reason text,
  is_claimable boolean,
  location_id uuid,
  location_name text,
  location_street text,
  location_postal_code text,
  location_city text,
  location_phone text,
  location_website text,
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
    f.id, f.title, f.description, f.category, f.cover_image_path, f.image_paths,
    f.original_price_cents, f.deal_price_cents, f.discount_percent,
    f.type, f.starts_at, f.ends_at, f.relevant_at,
    f.capacity, f.free_seats, f.max_per_user,
    f.address, f.lat, f.lng, f.status, f.status_reason, f.is_claimable,
    f.location_id, f.location_name, f.location_street, f.location_postal_code, f.location_city,
    f.location_phone, f.location_website,
    f.company_id, f.company_name, f.company_description, f.company_logo_path
  from private.offer_feed f
  where f.id = p_offer_id
    and (
      (f.status = 'aktiv' and f.location_status = 'approved')
      or f.location_id = (select private.my_location_id())
      or (select private.is_admin())
      or exists (
        select 1 from public.vouchers v
        where v.offer_id = f.id and v.user_id = (select auth.uid())
      )
    );
$$;

comment on function public.get_offer is
  'Detail eines Angebots inkl. Standort und Unternehmen. Leeres Ergebnis, wenn nicht sichtbar.';

-- ----------------------------------------------------------------------------
-- log_offer_view: Kennzahl „Angebot angesehen“
-- Gleicher Nutzer + gleiches Angebot zählt höchstens einmal pro 30 Minuten.
-- ----------------------------------------------------------------------------
create function public.log_offer_view(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_offer public.offers;
begin
  select o.* into v_offer
  from public.offers o
  join public.locations l on l.id = o.location_id
  where o.id = p_offer_id and o.status = 'aktiv' and l.status = 'approved';
  if not found then
    return;
  end if;

  if v_uid is not null and exists (
    select 1 from public.events e
    where e.type = 'angebot_angesehen' and e.offer_id = p_offer_id and e.user_id = v_uid
      and e.created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  perform private.log_event('angebot_angesehen', v_offer, v_uid);
end;
$$;

comment on function public.log_offer_view is
  'Zählt einen Aufruf der Detailseite (für Kennzahlen). Auch ohne Login. Wirft keine Fehler.';

-- ----------------------------------------------------------------------------
-- get_settings: globale Einstellungen (z. B. Mindestrabatt fürs Formular)
-- ----------------------------------------------------------------------------
create function public.get_settings()
returns public.settings
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.settings where id;
$$;

comment on function public.get_settings is 'Globale Einstellungen (Mindestrabatt, Fristen, Limits).';

-- ----------------------------------------------------------------------------
-- Rechte
-- ----------------------------------------------------------------------------
revoke all on function public.list_offers(public.offer_category, uuid[], boolean, integer, integer) from public;
revoke all on function public.get_offer(uuid) from public;
revoke all on function public.log_offer_view(uuid) from public;
revoke all on function public.get_settings() from public;

grant execute on function public.list_offers(public.offer_category, uuid[], boolean, integer, integer) to anon, authenticated;
grant execute on function public.get_offer(uuid) to anon, authenticated;
grant execute on function public.log_offer_view(uuid) to anon, authenticated;
grant execute on function public.get_settings() to anon, authenticated;
