-- ============================================================================
-- Test-Helfer. Werden vom Runner (pnpm db:test) INNERHALB der Test-Transaktion
-- angelegt und mit ihr zurückgerollt. Im Dev-Projekt bleibt nichts davon.
--
-- Alle Fixtures (Konten, Unternehmen, Angebote) entstehen ebenfalls nur in der
-- Transaktion. Sie tragen das Präfix „TEST AUTOTEST“.
-- ============================================================================

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Ablage für IDs innerhalb einer Testdatei: tests.set_id('nutzer', …), tests.id('nutzer')
create table tests.ids (k text primary key, v uuid);
grant select, insert on tests.ids to anon, authenticated;

create function tests.set_id(p_key text, p_value uuid)
returns uuid
language sql
as $$
  insert into tests.ids (k, v) values (p_key, p_value) returning v;
$$;

create function tests.id(p_key text)
returns uuid
language sql
stable
as $$
  select v from tests.ids where k = p_key;
$$;

-- Auth-Konto anlegen (löst den Trigger handle_new_user aus → Profil)
create function tests.create_user(p_email text, p_meta jsonb default '{}'::jsonb)
returns uuid
language sql
as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
  values (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, p_meta, '{"provider":"email","providers":["email"]}'::jsonb, now(), now(), now()
  )
  returning id;
$$;

-- Nutzer mit vollständigem Profil
create function tests.create_nutzer(p_name text default 'Testnutzer')
returns uuid
language sql
as $$
  select tests.create_user(
    'autotest+' || replace(gen_random_uuid()::text, '-', '') || '@example.com',
    jsonb_build_object('first_name', p_name, 'last_name', 'Autotest')
  );
$$;

create function tests.create_admin()
returns uuid
language plpgsql
as $$
declare
  v_id uuid := tests.create_user('autotest+admin' || replace(gen_random_uuid()::text, '-', '') || '@example.com');
begin
  update public.profiles set role = 'admin' where id = v_id;
  return v_id;
end;
$$;

-- Standort-Account + Unternehmen + Standort mit gewünschtem Status.
-- Gibt die location_id zurück; das Konto steht in locations.account_user_id.
create function tests.create_location(p_status public.location_status default 'approved')
returns uuid
language plpgsql
as $$
declare
  v_user uuid := tests.create_user(
    'autotest+standort' || replace(gen_random_uuid()::text, '-', '') || '@example.com',
    '{"account_type":"standort"}'::jsonb
  );
  v_company uuid;
  v_location uuid;
begin
  insert into public.companies (name) values ('TEST AUTOTEST Firma') returning id into v_company;
  insert into public.locations (company_id, account_user_id, name, street, postal_code, city, lat, lng, status)
  values (v_company, v_user, 'TEST AUTOTEST Standort', 'Prinzipalmarkt 1', '48143', 'Münster', 51.9625, 7.6280, p_status)
  returning id into v_location;
  return v_location;
end;
$$;

create function tests.location_user(p_location_id uuid)
returns uuid
language sql
as $$
  select account_user_id from public.locations where id = p_location_id;
$$;

-- Angebot direkt anlegen (umgeht die RPC-Prüfungen, z. B. für Termine in der Vergangenheit)
create function tests.create_offer(
  p_location_id uuid,
  p_type public.offer_type default 'einzeltermin',
  p_starts_at timestamptz default now() + interval '2 days',
  p_ends_at timestamptz default now() + interval '2 days 3 hours',
  p_capacity integer default 10,
  p_max_per_user integer default 2,
  p_original_price_cents integer default 4000,
  p_deal_price_cents integer default 2400
)
returns uuid
language sql
as $$
  insert into public.offers (
    location_id, title, description, category, image_paths, original_price_cents, deal_price_cents,
    capacity, max_per_user, address, lat, lng, type, starts_at, ends_at
  )
  values (
    p_location_id, 'TEST AUTOTEST Angebot', 'Automatisch erzeugtes Testangebot.', 'kochen_essen',
    array['test/bild-1.jpg'], p_original_price_cents, p_deal_price_cents, p_capacity, p_max_per_user,
    'Prinzipalmarkt 1, 48143 Münster', 51.9625, 7.6280, p_type, p_starts_at, p_ends_at
  )
  returning id;
$$;

-- Code direkt anlegen (z. B. für laufende oder vergangene Termine) und die
-- belegten Plätze des Angebots passend erhöhen.
create function tests.create_voucher(
  p_offer_id uuid,
  p_user_id uuid,
  p_seats integer default 1,
  p_status public.voucher_status default 'aktiv'
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.vouchers (offer_id, user_id, seats, token, short_code, status, cancel_reason)
  values (
    p_offer_id, p_user_id, p_seats, private.generate_token(), private.generate_short_code(), p_status,
    case when p_status = 'storniert' then 'nutzer'::public.voucher_cancel_reason end
  )
  returning id into v_id;
  if p_status in ('aktiv', 'eingeloest', 'no_show') then
    update public.offers set seats_taken = seats_taken + p_seats where id = p_offer_id;
  end if;
  return v_id;
end;
$$;

-- Als Konto auftreten (wie ein Request mit diesem JWT)
create function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Als nicht angemeldeter Besucher auftreten
create function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

-- Zurück zu postgres (Fixtures anlegen, Ergebnisse prüfen)
create function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Fehlercode (message) einer Anweisung, sonst null. Für Prüfungen auf Codes.
create function tests.error_code(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;
