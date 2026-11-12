-- ============================================================================
-- Helfer (Schema private), Trigger, RLS-Policies
--
-- Alle Helfer: security definer + set search_path = '' + voll qualifizierte
-- Namen. Das Schema private ist nicht über die Data API erreichbar. Nur die
-- Helfer, die in Policies vorkommen, sind für authenticated ausführbar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fehler mit festem Code werfen.
-- message = maschinenlesbarer Code (z. B. AUSGEBUCHT), detail = deutscher Text.
-- Die Codes stehen auch in packages/shared (RPC_ERROR_CODES).
-- ----------------------------------------------------------------------------
create function private.raise_error(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, p_code);
end;
$$;

-- ----------------------------------------------------------------------------
-- Rollen- und Zugehörigkeits-Helfer (auch in Policies genutzt)
-- ----------------------------------------------------------------------------
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function private.my_location_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id from public.locations l where l.account_user_id = (select auth.uid());
$$;

create function private.my_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.company_id from public.locations l where l.account_user_id = (select auth.uid());
$$;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.my_location_id() to authenticated;
grant execute on function private.my_company_id() to authenticated;

-- ----------------------------------------------------------------------------
-- Prüf-Helfer für RPCs (werfen Fehlercodes)
-- ----------------------------------------------------------------------------
create function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    perform private.raise_error('NICHT_ANGEMELDET', 'Bitte melde dich an.');
  end if;
  return v_uid;
end;
$$;

create function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if not private.is_admin() then
    perform private.raise_error('KEIN_ZUGRIFF', 'Nur für Admins.');
  end if;
  return v_uid;
end;
$$;

-- Standort des angemeldeten Kontos; optional muss er freigeschaltet sein.
create function private.require_location(p_must_be_approved boolean default true)
returns public.locations
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_location public.locations;
begin
  select * into v_location from public.locations where account_user_id = v_uid;
  if not found then
    perform private.raise_error('KEIN_STANDORTKONTO', 'Dieses Konto gehört zu keinem Standort.');
  end if;
  if p_must_be_approved and v_location.status <> 'approved' then
    perform private.raise_error(
      'STANDORT_NICHT_FREIGESCHALTET',
      'Der Standort ist noch nicht freigeschaltet.'
    );
  end if;
  return v_location;
end;
$$;

create function private.get_settings()
returns public.settings
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.settings where id;
$$;

-- ----------------------------------------------------------------------------
-- Codes erzeugen
-- ----------------------------------------------------------------------------

-- 32 Zufallsbytes als base64url ohne Padding (43 Zeichen)
create function private.generate_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');
$$;

-- Kurzcode wie K7Q-4MX aus 31 gut lesbaren Zeichen (ohne 0/O, 1/I/L)
create function private.generate_short_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_code text := '';
begin
  for i in 0..5 loop
    -- 256 ist kein Vielfaches von 31: winzige Ungleichverteilung, für Kurzcodes unkritisch
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return substr(v_code, 1, 3) || '-' || substr(v_code, 4, 3);
end;
$$;

-- Eingabe vom Scanner oder per Hand: Kurzcode normalisieren, sonst null
create function private.normalize_short_code(p_input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(cleaned) = 6 then substr(cleaned, 1, 3) || '-' || substr(cleaned, 4, 3)
  end
  from (select upper(regexp_replace(coalesce(p_input, ''), '[^A-Za-z0-9]', '', 'g')) as cleaned) s;
$$;

-- ----------------------------------------------------------------------------
-- Kennzahlen-Event schreiben
-- ----------------------------------------------------------------------------
create function private.log_event(
  p_type public.event_type,
  p_offer public.offers,
  p_user_id uuid default null,
  p_voucher_id uuid default null,
  p_seats integer default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.events (type, offer_id, location_id, category, user_id, voucher_id, seats)
  values (p_type, p_offer.id, p_offer.location_id, p_offer.category, p_user_id, p_voucher_id, p_seats);
$$;

-- ----------------------------------------------------------------------------
-- Gibt es vergebene Codes? (aktiv, eingeloest, no_show)
-- Dann sind Zeit, Adresse und Preise gesperrt.
-- ----------------------------------------------------------------------------
create function private.offer_has_codes(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vouchers v
    where v.offer_id = p_offer_id and v.status in ('aktiv', 'eingeloest', 'no_show')
  );
$$;

-- ----------------------------------------------------------------------------
-- Alle aktiven Codes eines Angebots stornieren (Absage, Entfernen, Sperre).
-- Voraussetzung: Der Aufrufer hält die Zeilensperre auf dem Angebot.
-- Schreibt Events und je Code-Inhaber einen Outbox-Eintrag.
-- ----------------------------------------------------------------------------
create function private.cancel_active_vouchers(
  p_offer_id uuid,
  p_reason public.voucher_cancel_reason,
  p_message text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_location_name text;
  v_count integer;
  v_seats integer;
begin
  select * into v_offer from public.offers where id = p_offer_id;
  select l.name into v_location_name from public.locations l where l.id = v_offer.location_id;

  with cancelled as (
    update public.vouchers
    set status = 'storniert', cancelled_at = now(), cancel_reason = p_reason
    where offer_id = p_offer_id and status = 'aktiv'
    returning id, user_id, seats
  ),
  logged as (
    insert into public.events (type, offer_id, location_id, category, user_id, voucher_id, seats)
    select 'code_storniert', v_offer.id, v_offer.location_id, v_offer.category, c.user_id, c.id, c.seats
    from cancelled c
  ),
  notified as (
    insert into public.notification_outbox (type, recipient_user_id, offer_id, voucher_id, payload)
    select
      'angebot_abgesagt', c.user_id, v_offer.id, c.id,
      jsonb_build_object(
        'offer_title', v_offer.title,
        'offer_type', v_offer.type,
        'starts_at', v_offer.starts_at,
        'ends_at', v_offer.ends_at,
        'location_name', v_location_name,
        'message', p_message
      )
    from cancelled c
    where c.user_id is not null
    on conflict (type, voucher_id) do nothing
  )
  select count(*)::integer, coalesce(sum(seats), 0)::integer into v_count, v_seats from cancelled;

  update public.offers set seats_taken = seats_taken - v_seats where id = p_offer_id;
  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- Trigger: updated_at pflegen
-- ----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.companies
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.locations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.settings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.offers
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.vouchers
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: Profil für jedes neue Auth-Konto anlegen.
-- Metadaten aus dem Sign-up (user-editierbar!) bestimmen nur:
--   account_type = 'standort' → Rolle standort (kann ohne Admin-Freischaltung
--   nichts veröffentlichen), sonst nutzer. Admin nie über Metadaten.
--   Vor-/Nachname (auch given_name/family_name/full_name von Apple/Google).
-- ----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text := nullif(btrim(coalesce(v_meta ->> 'first_name', v_meta ->> 'given_name', '')), '');
  v_last text := nullif(btrim(coalesce(v_meta ->> 'last_name', v_meta ->> 'family_name', '')), '');
  v_full text := nullif(btrim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', '')), '');
begin
  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last := coalesce(v_last, nullif(btrim(substr(v_full, char_length(v_first) + 2)), ''));
  end if;

  insert into public.profiles (id, role, first_name, last_name)
  values (
    new.id,
    case when v_meta ->> 'account_type' = 'standort' then 'standort'::public.app_role else 'nutzer'::public.app_role end,
    left(v_first, 50),
    left(v_last, 50)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ----------------------------------------------------------------------------
-- RLS-Policies
-- ----------------------------------------------------------------------------

-- profiles: eigenes Profil; Admin alle. Ändern nur per RPC.
create policy "profiles: eigenes lesen, Admin alle" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- companies: eigenes Unternehmen (über den Standort); Admin alle
create policy "companies: eigenes lesen, Admin alle" on public.companies
  for select to authenticated
  using (id = (select private.my_company_id()) or (select private.is_admin()));

-- locations: eigener Standort; Admin alle
create policy "locations: eigenen lesen, Admin alle" on public.locations
  for select to authenticated
  using (account_user_id = (select auth.uid()) or (select private.is_admin()));

-- settings: für alle lesbar (Clients brauchen z. B. den Mindestrabatt)
create policy "settings: alle lesen" on public.settings
  for select to anon, authenticated
  using (true);

-- offers: eigener Standort; Admin alle. Öffentliche Sicht nur über list_offers/get_offer.
create policy "offers: eigene lesen, Admin alle" on public.offers
  for select to authenticated
  using (location_id = (select private.my_location_id()) or (select private.is_admin()));

-- vouchers: eigene Codes; Standort: Codes seiner Angebote; Admin alle
create policy "vouchers: eigene, Standort seine, Admin alle" on public.vouchers
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or offer_id in (select o.id from public.offers o where o.location_id = (select private.my_location_id()))
    or (select private.is_admin())
  );

-- Favoriten: nur eigene Zeilen
create policy "favorite_locations: eigene lesen" on public.favorite_locations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favorite_locations: eigene anlegen" on public.favorite_locations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favorite_locations: eigene löschen" on public.favorite_locations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "favorite_categories: eigene lesen" on public.favorite_categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favorite_categories: eigene anlegen" on public.favorite_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favorite_categories: eigene löschen" on public.favorite_categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- push_tokens: eigene lesen und löschen; anlegen per RPC register_push_token
create policy "push_tokens: eigene lesen" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_tokens: eigene löschen" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- notification_outbox, events, geocode_cache: bewusst keine Policies.
-- Zugriff nur über Funktionen bzw. service_role.
