-- Öffentliche Standortdaten für die App einschließlich der Standortgalerie.
-- Es werden nur freigeschaltete Standorte zurückgegeben.

create function public.get_locations_public_with_images(p_location_ids uuid[])
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
  image_paths text[],
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
    coalesce(l.image_paths, '{}'::text[]),
    c.id, c.name, c.description, c.logo_path
  from public.locations l
  join public.companies c on c.id = l.company_id
  where l.status = 'approved'
    and l.id = any ((coalesce(p_location_ids, '{}'::uuid[]))[1:100])
  order by l.name, l.id;
$$;

comment on function public.get_locations_public_with_images(uuid[]) is
  'Freigeschaltete Standorte mit Unternehmensinfo und 0–5 öffentlichen Galeriepfaden für die App (max. 100 IDs).';

revoke all on function public.get_locations_public_with_images(uuid[]) from public, anon, authenticated;
grant execute on function public.get_locations_public_with_images(uuid[]) to anon, authenticated;
