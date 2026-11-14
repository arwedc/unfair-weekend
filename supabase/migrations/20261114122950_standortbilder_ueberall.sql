-- Alle öffentlichen Bilder einer Aktivität kommen wieder aus der Standortgalerie
-- (locations.image_paths, das erste Bild ist das Hauptbild). Feed, Detailseite,
-- Standortseite und „Meine Codes“ zeigen damit dasselbe Bild.
--
-- Hintergrund: 20261114120531_angebotsbilder_pro_angebot hatte eigene
-- Angebotsbilder mit Vorrang vor der Galerie ausgegeben. Die App zeigte dadurch
-- im Feed ein anderes Bild als auf der Angebotsseite.
--
-- Die vorhandenen Werte in offers.image_paths bleiben in der Tabelle, werden aber
-- nicht mehr öffentlich ausgegeben. Neue oder geänderte Angebote speichern wieder
-- keine eigenen Bilder (wie in 20261113174342_standort_bilder). Signaturen und
-- Spalten bleiben gleich.

drop trigger if exists offers_clear_legacy_images on public.offers;
create trigger offers_clear_legacy_images
before insert or update of image_paths on public.offers
for each row execute function private.clear_activity_images();

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

-- „Meine Codes“: Titelbild ebenfalls aus der Standortgalerie statt aus dem Angebot.
create or replace function public.get_my_vouchers()
returns table (
  id uuid,
  status public.voucher_status,
  seats integer,
  token text,
  short_code text,
  claimed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason public.voucher_cancel_reason,
  redeemed_at timestamptz,
  can_cancel boolean,
  cancel_deadline timestamptz,
  offer_id uuid,
  offer_title text,
  offer_type public.offer_type,
  offer_status public.offer_status,
  starts_at timestamptz,
  ends_at timestamptz,
  cover_image_path text,
  address text,
  lat double precision,
  lng double precision,
  location_id uuid,
  location_name text,
  company_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id, v.status, v.seats, v.token, v.short_code, v.claimed_at, v.cancelled_at, v.cancel_reason,
    v.redeemed_at,
    (
      v.status = 'aktiv'
      and case
        when o.type = 'einzeltermin' then now() <= o.starts_at - make_interval(hours => s.cancel_deadline_hours)
        else now() < o.ends_at
      end
    ) as can_cancel,
    case when o.type = 'einzeltermin' then o.starts_at - make_interval(hours => s.cancel_deadline_hours) else o.ends_at end
      as cancel_deadline,
    o.id, o.title, o.type, o.status, o.starts_at, o.ends_at, l.image_paths[1], o.address, o.lat, o.lng,
    l.id, l.name, c.name
  from public.vouchers v
  join public.offers o on o.id = v.offer_id
  join public.locations l on l.id = o.location_id
  join public.companies c on c.id = l.company_id
  cross join public.settings s
  where v.user_id = (select auth.uid())
  order by (v.status = 'aktiv') desc,
    case when v.status = 'aktiv' then o.relevant_at end asc,
    v.claimed_at desc;
$$;
