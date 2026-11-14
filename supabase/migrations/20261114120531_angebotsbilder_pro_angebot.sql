-- Aus supabase_migrations.schema_migrations des Dev-Projekts übernommen:
-- Die Migration war eingespielt, die Datei fehlte aber im Repo.

-- Angebotsbilder sind wieder angebotsbezogen. Die Standortgalerie bleibt als
-- Rückfallbild für ältere Angebote erhalten.

drop trigger if exists offers_clear_legacy_images on public.offers;

create or replace view private.offer_feed as
select
  o.id,
  o.title,
  o.description,
  o.category,
  coalesce(nullif(o.image_paths, '{}'::text[]), l.image_paths) as image_paths,
  coalesce(o.image_paths[1], l.image_paths[1]) as cover_image_path,
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

create function pg_temp.unsplash_image(p_photo_id text)
returns text
language sql
immutable
as $$
  select format('https://images.unsplash.com/%s?auto=format&fit=crop&w=1200&q=85', p_photo_id);
$$;

with offer_images (id, image_url) as (values
  ('5eed0000-0000-4000-8000-000000000301'::uuid, pg_temp.unsplash_image('photo-1556911261-6bd341186b2f')),
  ('5eed0000-0000-4000-8000-000000000302'::uuid, pg_temp.unsplash_image('photo-1653233797467-1a528819fd4f')),
  ('5eed0000-0000-4000-8000-000000000303'::uuid, pg_temp.unsplash_image('photo-1551218808-94e220e084d2')),
  ('5eed0000-0000-4000-8000-000000000304'::uuid, pg_temp.unsplash_image('photo-1510812431401-41d2bd2722f3')),
  ('5eed0000-0000-4000-8000-000000000305'::uuid, pg_temp.unsplash_image('photo-1672223550220-df93d147fa4c')),
  ('5eed0000-0000-4000-8000-000000000306'::uuid, pg_temp.unsplash_image('photo-1622279457486-62dcc4a431d6')),
  ('5eed0000-0000-4000-8000-000000000307'::uuid, pg_temp.unsplash_image('photo-1777715329494-82b92bc4874f')),
  ('5eed0000-0000-4000-8000-000000000308'::uuid, pg_temp.unsplash_image('photo-1777315168408-4e366dda1515')),
  ('5eed0000-0000-4000-8000-000000000309'::uuid, pg_temp.unsplash_image('photo-1753098498106-0319c1d646ca')),
  ('5eed0000-0000-4000-8000-000000000310'::uuid, pg_temp.unsplash_image('photo-1585699324551-f6c309eedeca')),
  ('5eed0000-0000-4000-8000-000000000311'::uuid, pg_temp.unsplash_image('photo-1489599849927-2ee91cede3ba')),
  ('5eed0000-0000-4000-8000-000000000312'::uuid, pg_temp.unsplash_image('photo-1770520871616-d7379585fc9a')),
  ('5eed0000-0000-4000-8000-000000000313'::uuid, pg_temp.unsplash_image('photo-1768350329800-3a3231d18ab3')),
  ('5eed0000-0000-4000-8000-000000000314'::uuid, pg_temp.unsplash_image('photo-1665068960452-eee7367e4e1c')),
  ('5eed0000-0000-4000-8000-000000000315'::uuid, pg_temp.unsplash_image('photo-1634001112772-8a46568f0c43')),
  ('5eed0000-0000-4000-8000-000000000316'::uuid, pg_temp.unsplash_image('photo-1547592180-85f173990554')),
  ('5eed0000-0000-4000-8000-000000000317'::uuid, pg_temp.unsplash_image('photo-1489599849927-2ee91cede3ba')),
  ('5eed0000-0000-4000-8000-000000000318'::uuid, pg_temp.unsplash_image('photo-1585699324551-f6c309eedeca'))
)
update public.offers as o
set image_paths = array[offer_images.image_url]
from offer_images
where o.id = offer_images.id;
