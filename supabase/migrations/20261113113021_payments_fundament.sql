-- ============================================================================
-- Zahlungen (Variante B), Teil 1: Typen, Tabellen, RLS, Realtime
--
-- Rein additiv: nur neue Typen und Tabellen. Variante A bleibt unverändert.
-- Das Flag payment_settings.payments_enabled steht auf aus. Solange es aus ist,
-- wirken die neuen Regeln (Teil 2) nicht. Fachliche Regeln: docs/SPEC-PAYMENTS.md
--
-- Geschrieben wird nur über Funktionen (Teil 2) bzw. service_role (Edge
-- Functions). Clients lesen ihre Zeilen direkt, RLS filtert.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Typen. Neue Werte nur anhängen, nie umbenennen. Labels in packages/shared.
-- ----------------------------------------------------------------------------

-- Lebenszyklus einer bezahlten Buchung
create type public.booking_status as enum (
  'reserviert',  -- Plätze gehalten, Zahlung läuft (reserved_until)
  'abgelaufen',  -- Reservierung ohne Zahlung verfallen, Plätze zurück
  'bezahlt',     -- Webhook hat die Zahlung bestätigt, Code existiert
  'storniert',   -- Code storniert (Erstattung offen oder ohne Erstattung)
  'erstattet',   -- Geld vollständig zurück
  'eingeloest',  -- Code eingelöst (vom Code übernommen)
  'no_show',     -- nicht erschienen, nur Statistik (vom Code übernommen)
  'ausgezahlt'   -- Transfer an den Standort ausgeführt
);

-- Warum eine Buchung storniert bzw. erstattet wurde
create type public.booking_cancel_reason as enum (
  'nutzer',            -- Storno durch den Nutzer (vor der Frist)
  'angebot_abgesagt',  -- Absage durch den Standort oder Sperre des Standorts
  'angebot_entfernt',  -- Admin hat das Angebot entfernt
  'konto_geloescht',   -- Nutzer hat sein Konto gelöscht
  'zahlung_zu_spaet'   -- Zahlung kam nach Ablauf der Reservierung, Platz weg
);

-- Erstattung
create type public.refund_status as enum (
  'offen',          -- noch nicht an Stripe geschickt
  'angefragt',      -- Stripe hat die Erstattung angenommen, noch nicht fertig
  'erstattet',      -- abgeschlossen
  'fehlgeschlagen'  -- endgültig gescheitert, Admin klärt
);

-- Transfer an das Stripe-Konto des Standorts
create type public.transfer_status as enum (
  'ueberwiesen',     -- Transfer angelegt (Stripe führt ihn mit source_transaction aus)
  'zurueckholen',    -- Absage nach der Auszahlung: Transfer muss zurück
  'zurueckgeholt',   -- Transfer-Reversal ausgeführt
  'fehlgeschlagen'   -- Rückholung gescheitert, Admin klärt
);

-- Arbeitsliste für den Stripe-Worker
create type public.payment_job_kind as enum (
  'pi_abbrechen',             -- PaymentIntent einer verfallenen Reservierung abbrechen
  'erstatten',                -- Erstattung ausführen
  'auszahlen',                -- Transfer an den Standort
  'auszahlung_zurueckholen'   -- Transfer-Reversal
);

create type public.payment_job_status as enum ('offen', 'laeuft', 'erledigt', 'fehlgeschlagen');

-- ----------------------------------------------------------------------------
-- payment_settings: genau eine Zeile. Separat von settings, damit
-- update_settings und settingsSchema (Variante A) unverändert bleiben.
-- ----------------------------------------------------------------------------
create table public.payment_settings (
  id boolean primary key default true check (id),
  payments_enabled boolean not null default false,
  -- Provision in Basispunkten: 1500 = 15,00 %
  commission_bps integer not null default 1500 check (commission_bps between 0 and 5000),
  reservation_minutes integer not null default 10 check (reservation_minutes between 5 and 30),
  payout_delay_hours integer not null default 24 check (payout_delay_hours between 0 and 168),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.payment_settings is
  'Zahlungen (Variante B): Flag payments_enabled (Standard aus), Provision in Basispunkten, Reservierungsdauer, Auszahlungsverzug. Genau eine Zeile.';

insert into public.payment_settings default values;

create index payment_settings_updated_by_idx on public.payment_settings (updated_by);

create trigger set_updated_at before update on public.payment_settings
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- stripe_accounts: ein Stripe-Connect-Konto pro Standort
-- Bereit für Buchungen = Transfers aktiv und Auszahlungen aktiv
-- (Separate Charges and Transfers: der Standort nimmt selbst keine Zahlungen an).
-- ----------------------------------------------------------------------------
create table public.stripe_accounts (
  location_id uuid primary key references public.locations (id) on delete restrict,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  transfers_active boolean not null default false,
  requirements_due text[] not null default '{}',
  disabled_reason text,
  is_ready boolean generated always as (transfers_active and payouts_enabled) stored,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stripe_accounts is
  'Stripe-Connect-Konto pro Standort. Geschrieben nur von den Edge Functions (Onboarding, Webhook account.updated).';

create trigger set_updated_at before update on public.stripe_accounts
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- paid_bookings: eine bezahlte Buchung (Reservierung → Zahlung → Code)
-- Beträge rechnet nur der Server aus offers.deal_price_cents.
-- ----------------------------------------------------------------------------
create table public.paid_bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete restrict,
  location_id uuid not null references public.locations (id) on delete restrict,
  user_id uuid references public.profiles (id) on delete set null,
  seats integer not null check (seats between 1 and 20),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  amount_cents integer not null,
  commission_bps integer not null check (commission_bps between 0 and 5000),
  commission_cents integer not null,
  payout_cents integer generated always as (amount_cents - commission_cents) stored,
  currency text not null default 'eur' check (currency = 'eur'),
  status public.booking_status not null default 'reserviert',
  reserved_until timestamptz not null,
  payment_intent_id text unique check (payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  charge_id text unique check (charge_id ~ '^(ch|py)_[A-Za-z0-9]+$'),
  voucher_id uuid unique references public.vouchers (id),
  cancel_reason public.booking_cancel_reason,
  paid_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  paid_out_at timestamptz,
  payout_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paid_bookings_amount_check
    check (amount_cents = unit_price_cents * seats and amount_cents >= 50),
  constraint paid_bookings_commission_check
    check (commission_cents between 0 and amount_cents),
  constraint paid_bookings_paid_has_voucher
    check (status not in ('bezahlt', 'eingeloest', 'no_show') or voucher_id is not null)
);

comment on table public.paid_bookings is
  'Bezahlte Buchungen (Variante B). Provision wird beim Buchen festgeschrieben. Status bezahlt setzt nur der verifizierte Stripe-Webhook.';

-- Höchstens eine offene Reservierung pro Nutzer und Angebot
create unique index paid_bookings_one_open_per_user_idx
  on public.paid_bookings (offer_id, user_id) where status = 'reserviert';
create index paid_bookings_user_id_idx on public.paid_bookings (user_id, created_at desc);
create index paid_bookings_location_id_idx on public.paid_bookings (location_id, created_at desc);
create index paid_bookings_offer_id_idx on public.paid_bookings (offer_id);
create index paid_bookings_reserved_until_idx
  on public.paid_bookings (reserved_until) where status = 'reserviert';
create index paid_bookings_payout_due_idx
  on public.paid_bookings (payout_due_at)
  where status in ('bezahlt', 'eingeloest', 'no_show', 'storniert');

create trigger set_updated_at before update on public.paid_bookings
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- payment_refunds: höchstens eine (Voll-)Erstattung pro Buchung
-- ----------------------------------------------------------------------------
create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.paid_bookings (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  reason public.booking_cancel_reason not null,
  status public.refund_status not null default 'offen',
  stripe_refund_id text unique check (stripe_refund_id ~ '^(re|pyr)_[A-Za-z0-9]+$'),
  last_error text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.payment_refunds
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- payment_transfers: höchstens ein Transfer pro Buchung (immer mit source_transaction)
-- ----------------------------------------------------------------------------
create table public.payment_transfers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.paid_bookings (id) on delete restrict,
  location_id uuid not null references public.locations (id) on delete restrict,
  destination_account_id text not null,
  source_charge_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  status public.transfer_status not null default 'ueberwiesen',
  stripe_transfer_id text not null unique check (stripe_transfer_id ~ '^tr_[A-Za-z0-9]+$'),
  stripe_reversal_id text unique,
  last_error text,
  transferred_at timestamptz not null default now(),
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_transfers_location_id_idx on public.payment_transfers (location_id, transferred_at desc);

create trigger set_updated_at before update on public.payment_transfers
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- payment_disputes: Rückbuchungen (charge.dispute.*), nur für Admins
-- ----------------------------------------------------------------------------
create table public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique check (stripe_dispute_id ~ '^(dp|du)_[A-Za-z0-9]+$'),
  booking_id uuid references public.paid_bookings (id) on delete restrict,
  charge_id text,
  amount_cents integer not null check (amount_cents >= 0),
  reason text,
  stripe_status text not null,
  evidence_due_by timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_disputes_booking_id_idx on public.payment_disputes (booking_id);

create trigger set_updated_at before update on public.payment_disputes
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- stripe_webhook_events: verarbeitete Event-IDs (Idempotenz)
-- ----------------------------------------------------------------------------
create table public.stripe_webhook_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]+$'),
  type text not null,
  livemode boolean not null default false,
  stripe_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 1 check (attempts >= 1),
  last_error text
);

create index stripe_webhook_events_unprocessed_idx
  on public.stripe_webhook_events (received_at) where processed_at is null;

-- ----------------------------------------------------------------------------
-- payment_jobs: Arbeitsliste für den Stripe-Worker (Edge Function)
-- Je Art und Buchung höchstens ein Job.
-- ----------------------------------------------------------------------------
create table public.payment_jobs (
  id bigint generated always as identity primary key,
  kind public.payment_job_kind not null,
  booking_id uuid not null references public.paid_bookings (id) on delete restrict,
  status public.payment_job_status not null default 'offen',
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint payment_jobs_kind_booking_key unique (kind, booking_id)
);

create index payment_jobs_due_idx
  on public.payment_jobs (next_attempt_at) where status in ('offen', 'laeuft');
create index payment_jobs_booking_id_idx on public.payment_jobs (booking_id);

-- ----------------------------------------------------------------------------
-- RLS und Rechte
-- ----------------------------------------------------------------------------
alter table public.payment_settings enable row level security;
alter table public.stripe_accounts enable row level security;
alter table public.paid_bookings enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_transfers enable row level security;
alter table public.payment_disputes enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.payment_jobs enable row level security;

revoke all on table
  public.payment_settings, public.stripe_accounts, public.paid_bookings,
  public.payment_refunds, public.payment_transfers, public.payment_disputes,
  public.stripe_webhook_events, public.payment_jobs
from anon, authenticated;

grant select on table public.payment_settings to anon, authenticated;
grant select on table
  public.stripe_accounts, public.paid_bookings, public.payment_refunds,
  public.payment_transfers, public.payment_disputes, public.stripe_webhook_events,
  public.payment_jobs
to authenticated;

-- payment_settings: für alle lesbar (App und Website brauchen das Flag)
create policy "payment_settings: alle lesen" on public.payment_settings
  for select to anon, authenticated
  using (true);

-- stripe_accounts: eigener Standort; Admin alle
create policy "stripe_accounts: eigener Standort, Admin alle" on public.stripe_accounts
  for select to authenticated
  using (location_id = (select private.my_location_id()) or (select private.is_admin()));

-- paid_bookings: eigene Buchungen; Standort: Buchungen seiner Angebote; Admin alle
create policy "paid_bookings: eigene, Standort seine, Admin alle" on public.paid_bookings
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or location_id = (select private.my_location_id())
    or (select private.is_admin())
  );

-- payment_refunds: sichtbar, wenn die Buchung sichtbar ist (RLS von paid_bookings greift)
create policy "payment_refunds: wie die Buchung" on public.payment_refunds
  for select to authenticated
  using (booking_id in (select b.id from public.paid_bookings b));

-- payment_transfers: Standort seine; Admin alle
create policy "payment_transfers: Standort seine, Admin alle" on public.payment_transfers
  for select to authenticated
  using (location_id = (select private.my_location_id()) or (select private.is_admin()));

-- Nur Admins: Rückbuchungen, Webhook-Protokoll, Arbeitsliste
create policy "payment_disputes: nur Admin" on public.payment_disputes
  for select to authenticated
  using ((select private.is_admin()));
create policy "stripe_webhook_events: nur Admin" on public.stripe_webhook_events
  for select to authenticated
  using ((select private.is_admin()));
create policy "payment_jobs: nur Admin" on public.payment_jobs
  for select to authenticated
  using ((select private.is_admin()));

-- ----------------------------------------------------------------------------
-- Realtime: Die App beobachtet den Status ihrer Buchung (RLS gilt auch hier).
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.paid_bookings;
