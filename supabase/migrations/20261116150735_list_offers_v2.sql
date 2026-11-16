-- ============================================================================
-- list_offers_v2: Feed in EINER Anfrage
--
-- Wie list_offers, zusätzlich pro Angebot:
--   created_at               Veröffentlichungszeit (bisher list_offer_created_at)
--   location_review_count    sichtbare Bewertungen des Standorts (bisher get_location_ratings)
--   location_average_rating  Schnitt auf eine Nachkommastelle, null ohne Bewertungen
--
-- Die App brauchte für den Feed bisher drei Anfragen nacheinander. list_offers,
-- list_offer_created_at und get_location_ratings bleiben unverändert bestehen.
-- ============================================================================
create function public.list_offers_v2(
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
  company_logo_path text,
  created_at timestamptz,
  location_review_count integer,
  location_average_rating numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with page as (
    select f.*
    from private.offer_feed f
    where f.is_claimable
      and (p_category is null or f.category = p_category)
      and (p_location_ids is null or f.location_id = any (p_location_ids))
      and (not coalesce(p_only_available, false) or f.free_seats > 0)
    order by f.relevant_at, f.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  -- Bewertungen nur für die Standorte dieser Seite, einmal pro Standort
  ratings as (
    select r.location_id, count(*)::integer as review_count, round(avg(r.rating), 1) as average_rating
    from public.reviews r
    where r.hidden_at is null
      and r.location_id in (select p.location_id from page p)
    group by r.location_id
  )
  select
    p.id, p.title, p.category, p.cover_image_path, p.image_paths,
    p.original_price_cents, p.deal_price_cents, p.discount_percent,
    p.type, p.starts_at, p.ends_at, p.relevant_at,
    p.capacity, p.free_seats, p.max_per_user,
    p.address, p.lat, p.lng,
    p.location_id, p.location_name, p.company_id, p.company_name, p.company_logo_path,
    o.created_at,
    coalesce(rt.review_count, 0),
    rt.average_rating
  from page p
  join public.offers o on o.id = p.id
  left join ratings rt on rt.location_id = p.location_id
  order by p.relevant_at, p.id;
$$;

comment on function public.list_offers_v2 is
  'Feed wie list_offers, zusätzlich created_at sowie Anzahl und Schnitt der sichtbaren Bewertungen des Standorts. Ersetzt in der App die Folgeaufrufe list_offer_created_at und get_location_ratings. Max. 100 pro Seite.';

revoke all on function public.list_offers_v2(public.offer_category, uuid[], boolean, integer, integer) from public;
grant execute on function public.list_offers_v2(public.offer_category, uuid[], boolean, integer, integer) to anon, authenticated;
