
-- Standortbilder werden einmal pro Partner-Standort gepflegt und von allen
-- Aktivitäten des Standorts verwendet. Das erste Bild ist das Hauptbild.

alter table public.locations
  add column image_paths text[] not null default '{}',
  add constraint locations_image_paths_check check (
    cardinality(image_paths) between 0 and 5
    and array_position(image_paths, null) is null
  );

comment on column public.locations.image_paths is
  '0–5 Storage-Pfade im Bucket offer-images; das erste Bild ist das Hauptbild.';

-- Vorhandene Angebots- und Vorlagenbilder je Standort übernehmen. Hauptbilder
-- haben Vorrang; es werden höchstens fünf unterschiedliche Storage-Pfade kopiert.
with source_images as (
  select o.location_id, p.path, (p.ordinality = 1)::integer as cover_rank,
    o.created_at, p.ordinality
  from public.offers o
  cross join lateral unnest(o.image_paths) with ordinality as p(path, ordinality)
  union all
  select t.location_id, p.path, (p.ordinality = 1)::integer as cover_rank,
    t.created_at, p.ordinality
  from public.offer_templates t
  cross join lateral unnest(t.image_paths) with ordinality as p(path, ordinality)
), distinct_images as (
  select distinct on (s.location_id, s.path)
    s.location_id, s.path, s.cover_rank, s.created_at, s.ordinality
  from source_images s
  join public.locations l on l.id = s.location_id
  where s.path like l.id::text || '/%'
  order by s.location_id, s.path, s.cover_rank, s.created_at, s.ordinality
), ranked_images as (
  select d.location_id, d.path,
    row_number() over (
      partition by d.location_id
      order by d.cover_rank, d.created_at, d.ordinality, d.path
    ) as position
  from distinct_images d
)
update public.locations l
set image_paths = coalesce((
  select array_agg(r.path order by r.position)
  from ranked_images r
  where r.location_id = l.id and r.position <= 5
), '{}'::text[]);

-- Einzelbilder aus den bisherigen Datensätzen entfernen. Ab jetzt werden
-- öffentliche Aktivitäten ausschließlich über die Standortgalerie bebildert.
update public.offers set image_paths = '{}'::text[] where cardinality(image_paths) > 0;
update public.offer_templates set image_paths = '{}'::text[] where cardinality(image_paths) > 0;

create function private.clear_activity_images()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.image_paths := '{}'::text[];
  return new;
end;
$$;

create trigger offers_clear_legacy_images
before insert or update of image_paths on public.offers
for each row execute function private.clear_activity_images();

create trigger offer_templates_clear_legacy_images
before insert or update of image_paths on public.offer_templates
for each row execute function private.clear_activity_images();

revoke all on function private.clear_activity_images() from public, anon, authenticated;

create or replace function public.update_my_location_images(p_image_paths text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(false);
  v_paths text[] := coalesce(p_image_paths, '{}'::text[]);
begin
  if cardinality(v_paths) > 5
    or array_position(v_paths, null) is not null
    or exists (
      select 1 from unnest(v_paths) as p(path)
      where char_length(btrim(p.path)) not between 1 and 500
        or p.path not like v_location.id::text || '/%'
    )
    or cardinality(v_paths) <> (select count(distinct p.path) from unnest(v_paths) as p(path))
    or exists (
      select 1
      from unnest(v_paths) as p(path)
      left join storage.objects o on o.bucket_id = 'offer-images' and o.name = p.path
      where o.name is null
    )
  then
    perform private.raise_error('BILDER_UNGUELTIG', 'Bitte höchstens fünf gültige Standortbilder auswählen.');
  end if;

  update public.locations
  set image_paths = v_paths
  where id = v_location.id;

  return v_paths;
end;
$$;

comment on function public.update_my_location_images(text[]) is
  'Speichert bis zu fünf Bilder des eigenen Standorts. Das erste Bild ist das Hauptbild.';

revoke all on function public.update_my_location_images(text[]) from public, anon;
grant execute on function public.update_my_location_images(text[]) to authenticated;

-- Die bestehenden RPC-Signaturen bleiben erhalten. Ihre öffentliche Bildausgabe
-- kommt nun aus locations statt aus offers.
create or replace view private.offer_feed as
select
  o.id,
  o.title,
  o.description,
  o.category,
  l.image_paths,
  l.image_paths[1] as cover_image_path,
  o.original_price_cents,
  o.deal_price_cents,
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
  (
    o.status = 'aktiv'
    and l.status = 'approved'
    and case when o.type = 'einzeltermin' then o.starts_at > now() else o.ends_at > now() end
  ) as is_claimable
from public.offers o
join public.locations l on l.id = o.location_id
join public.companies c on c.id = l.company_id;

revoke all on private.offer_feed from public, anon, authenticated;
