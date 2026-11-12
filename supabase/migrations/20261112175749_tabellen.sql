-- ============================================================================
-- Tabellen, Constraints, Indizes, RLS aktiv, Grants
-- Policies folgen in der nächsten Migration (brauchen die Helfer aus private).
--
-- Grundsatz: Clients lesen Tabellen höchstens (per RLS gefiltert).
-- Geschrieben wird ausschließlich über RPCs (security definer), die alle
-- Geschäftsregeln prüfen. Ausnahme: Favoriten (eigene Zeilen anlegen/löschen).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: ein Eintrag pro Auth-Konto (Nutzer, Standort-Account, Admin)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'nutzer',
  first_name text check (first_name is null or char_length(first_name) between 1 and 50),
  last_name text check (last_name is null or char_length(last_name) between 1 and 50),
  -- No-Shows seit der letzten Sperre; wird beim Sperren auf 0 gesetzt
  no_show_count integer not null default 0 check (no_show_count >= 0),
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Ein Profil pro Auth-Konto. Rolle bestimmt die Rechte. Wird per Trigger angelegt.';
comment on column public.profiles.no_show_count is 'No-Shows seit der letzten Sperre (Einzeltermine).';

-- ----------------------------------------------------------------------------
-- companies: Unternehmen mit einem oder mehreren Standorten
-- ----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  description text check (description is null or char_length(description) <= 2000),
  -- Pfad im Bucket company-logos (oder absolute URL im Seed)
  logo_path text check (logo_path is null or char_length(logo_path) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.companies is 'Unternehmen (Name, Logo, Beschreibung). Hat einen oder mehrere Standorte.';

-- ----------------------------------------------------------------------------
-- locations: Standort mit genau einem Login (account_user_id)
-- ----------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  account_user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  street text not null check (char_length(btrim(street)) between 2 and 120),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  city text not null check (char_length(btrim(city)) between 2 and 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  phone text check (phone is null or char_length(phone) <= 40),
  website text check (website is null or char_length(website) <= 300),
  status public.location_status not null default 'pending',
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_coordinates_together check ((lat is null) = (lng is null))
);
comment on table public.locations is 'Standort eines Unternehmens. Genau ein Login pro Standort. Angebote erst nach Freischaltung (approved).';

create index locations_company_id_idx on public.locations (company_id);
create index locations_status_idx on public.locations (status);
create index locations_status_changed_by_idx on public.locations (status_changed_by);

-- ----------------------------------------------------------------------------
-- settings: globale Admin-Einstellungen (genau eine Zeile)
-- ----------------------------------------------------------------------------
create table public.settings (
  id boolean primary key default true check (id),
  min_discount_percent integer not null default 20 check (min_discount_percent between 0 and 100),
  cancel_deadline_hours integer not null default 3 check (cancel_deadline_hours between 0 and 168),
  no_show_limit integer not null default 2 check (no_show_limit between 1 and 20),
  block_days integer not null default 30 check (block_days between 1 and 365),
  reminder_hours_before integer not null default 2 check (reminder_hours_before between 0 and 72),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table public.settings is 'Globale Einstellungen (eine Zeile). Ändern nur per update_settings (Admin).';
comment on column public.settings.cancel_deadline_hours is 'Einzeltermin: Storno bis so viele Stunden vor Start.';
comment on column public.settings.no_show_limit is 'Nach so vielen No-Shows wird gesperrt.';
comment on column public.settings.block_days is 'Sperrdauer in Tagen.';
comment on column public.settings.reminder_hours_before is 'Erinnerung so viele Stunden vor Start (Einzeltermin).';

insert into public.settings default values;

create index settings_updated_by_idx on public.settings (updated_by);

-- ----------------------------------------------------------------------------
-- offers: Angebote eines Standorts
-- ----------------------------------------------------------------------------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  category public.offer_category not null,
  -- 1–5 Bilder, das erste ist das Titelbild. Storage-Pfade im Bucket offer-images
  -- (Seed: absolute Platzhalter-URLs).
  image_paths text[] not null check (
    cardinality(image_paths) between 1 and 5
    and array_position(image_paths, null) is null
  ),
  original_price_cents integer not null check (original_price_cents between 1 and 10000000),
  deal_price_cents integer not null check (deal_price_cents >= 0),
  capacity integer not null check (capacity between 1 and 1000),
  -- vergebene Plätze aktiver + eingelöster + No-Show-Codes; wird nur unter
  -- Zeilensperre in den RPCs gepflegt. Der CHECK verhindert Überbuchung hart.
  seats_taken integer not null default 0 check (seats_taken >= 0),
  max_per_user integer not null default 1 check (max_per_user between 1 and 20),
  address text not null check (char_length(btrim(address)) between 5 and 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  type public.offer_type not null,
  -- Einzeltermin: Beginn/Ende. Zeitraum: einlösbar von/bis.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Sortierschlüssel „als Nächstes relevant“
  relevant_at timestamptz generated always as (
    case when type = 'einzeltermin' then starts_at else ends_at end
  ) stored,
  status public.offer_status not null default 'aktiv',
  status_reason text check (status_reason is null or char_length(status_reason) <= 500),
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_deal_below_original check (deal_price_cents < original_price_cents),
  constraint offers_seats_within_capacity check (seats_taken <= capacity),
  constraint offers_ends_after_start check (ends_at > starts_at)
);
comment on table public.offers is 'Angebote. Nach dem Speichern sofort live. Schreiben nur über RPCs.';
comment on column public.offers.seats_taken is 'Belegte Plätze (aktiv, eingeloest, no_show). CHECK seats_taken <= capacity verhindert Überbuchung.';
comment on column public.offers.relevant_at is 'Einzeltermin: starts_at, Zeitraum: ends_at. Sortierung „als Nächstes relevant“.';

create index offers_location_id_idx on public.offers (location_id);
create index offers_feed_idx on public.offers (relevant_at) where status = 'aktiv';
create index offers_feed_category_idx on public.offers (category, relevant_at) where status = 'aktiv';
create index offers_status_changed_by_idx on public.offers (status_changed_by);
create index offers_created_by_idx on public.offers (created_by);

-- ----------------------------------------------------------------------------
-- vouchers: Gutscheincodes
-- ----------------------------------------------------------------------------
create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete restrict,
  -- null nach Kontolöschung (anonymisiert, bleibt für Kennzahlen)
  user_id uuid references public.profiles (id) on delete set null,
  seats integer not null check (seats between 1 and 20),
  -- nicht erratbarer Token für den QR-Code (32 Zufallsbytes, base64url)
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  -- kurzer, lesbarer Code ohne verwechselbare Zeichen (0/O, 1/I/L)
  short_code text not null unique check (
    short_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}$'
  ),
  status public.voucher_status not null default 'aktiv',
  claimed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason public.voucher_cancel_reason,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  no_show_at timestamptz,
  no_show_by uuid references auth.users (id) on delete set null,
  expired_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint vouchers_cancel_reason_when_cancelled check ((status = 'storniert') = (cancel_reason is not null))
);
comment on table public.vouchers is 'Gutscheincodes. Schreiben nur über RPCs (claim, cancel, redeem, no_show).';
comment on column public.vouchers.token is 'Geheimer Token für den QR-Code. Nur der Inhaber und der Standort sehen ihn.';

-- höchstens ein aktiver Code pro Nutzer und Angebot
create unique index vouchers_one_active_per_user_idx
  on public.vouchers (offer_id, user_id) where status = 'aktiv';
create index vouchers_offer_id_status_idx on public.vouchers (offer_id, status);
create index vouchers_user_id_idx on public.vouchers (user_id, claimed_at desc);
create index vouchers_redeemed_by_idx on public.vouchers (redeemed_by);
create index vouchers_no_show_by_idx on public.vouchers (no_show_by);

-- ----------------------------------------------------------------------------
-- Favoriten
-- ----------------------------------------------------------------------------
create table public.favorite_locations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);
create index favorite_locations_location_id_idx on public.favorite_locations (location_id);

create table public.favorite_categories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category public.offer_category not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- ----------------------------------------------------------------------------
-- push_tokens: mehrere Geräte pro Nutzer
-- ----------------------------------------------------------------------------
create table public.push_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique check (char_length(token) between 1 and 500),
  platform public.push_platform not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

-- ----------------------------------------------------------------------------
-- notification_outbox: ausstehende Benachrichtigungen (Versand macht die App-Session)
-- ----------------------------------------------------------------------------
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  type public.notification_type not null,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  offer_id uuid references public.offers (id) on delete cascade,
  voucher_id uuid references public.vouchers (id) on delete cascade,
  -- Daten für den Text der Nachricht (Titel, Startzeit, Grund …)
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
comment on table public.notification_outbox is 'Ausstehende Benachrichtigungen. Ein Worker (Edge Function, service_role) holt sie mit FOR UPDATE SKIP LOCKED ab.';

-- jede Benachrichtigung höchstens einmal pro Code
create unique index notification_outbox_type_voucher_idx on public.notification_outbox (type, voucher_id);
create index notification_outbox_pending_idx on public.notification_outbox (next_attempt_at) where status = 'pending';
create index notification_outbox_recipient_idx on public.notification_outbox (recipient_user_id);
create index notification_outbox_offer_id_idx on public.notification_outbox (offer_id);

-- ----------------------------------------------------------------------------
-- events: Rohdaten für Kennzahlen
-- ----------------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  type public.event_type not null,
  offer_id uuid not null references public.offers (id) on delete cascade,
  -- denormalisiert, damit Auswertungen ohne Joins auskommen
  location_id uuid not null references public.locations (id) on delete cascade,
  category public.offer_category not null,
  user_id uuid references public.profiles (id) on delete set null,
  voucher_id uuid references public.vouchers (id) on delete set null,
  seats integer check (seats is null or seats >= 1),
  created_at timestamptz not null default now()
);
comment on table public.events is 'Kennzahlen-Events. Werden nur von Funktionen geschrieben.';

create index events_created_at_idx on public.events (created_at);
create index events_location_id_created_at_idx on public.events (location_id, created_at);
create index events_offer_id_idx on public.events (offer_id);
create index events_user_id_idx on public.events (user_id);
create index events_voucher_id_idx on public.events (voucher_id);

-- ----------------------------------------------------------------------------
-- geocode_cache: Adresse → Koordinaten
-- ----------------------------------------------------------------------------
create table public.geocode_cache (
  query text primary key check (char_length(query) between 3 and 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  display_name text,
  provider text not null default 'nominatim',
  created_at timestamptz not null default now()
);
comment on table public.geocode_cache is 'Cache für Geocoding (normalisierte Adresse → lat/lng). Nur service_role.';

-- ----------------------------------------------------------------------------
-- RLS überall aktiv. Ohne Policy sieht eine Rolle nichts.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.locations enable row level security;
alter table public.settings enable row level security;
alter table public.offers enable row level security;
alter table public.vouchers enable row level security;
alter table public.favorite_locations enable row level security;
alter table public.favorite_categories enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.events enable row level security;
alter table public.geocode_cache enable row level security;

-- ----------------------------------------------------------------------------
-- Grants: zuerst alles entziehen (unabhängig von Projekt-Standards),
-- dann nur das Nötige vergeben. Zeilen filtert RLS.
-- ----------------------------------------------------------------------------
revoke all on table
  public.profiles, public.companies, public.locations, public.settings, public.offers,
  public.vouchers, public.favorite_locations, public.favorite_categories, public.push_tokens,
  public.notification_outbox, public.events, public.geocode_cache
from anon, authenticated;

grant select on table public.settings to anon, authenticated;
grant select on table
  public.profiles, public.companies, public.locations, public.offers, public.vouchers,
  public.push_tokens
to authenticated;
grant select, insert, delete on table public.favorite_locations, public.favorite_categories to authenticated;
grant delete on table public.push_tokens to authenticated;
