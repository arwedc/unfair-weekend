-- ============================================================================
-- RPCs für Nutzer (App) und für jedes angemeldete Konto
--
-- Sperrreihenfolge (gegen Deadlocks): immer zuerst das Angebot (offers),
-- dann Codes (vouchers), dann Profile.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_my_account: Rolle, Profil, Sperre und ggf. Standort des angemeldeten Kontos
-- ----------------------------------------------------------------------------
create function public.get_my_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
  v_location jsonb;
begin
  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    perform private.raise_error('KEIN_PROFIL', 'Zu diesem Konto gibt es kein Profil.');
  end if;

  select jsonb_build_object(
    'id', l.id,
    'name', l.name,
    'status', l.status,
    'status_reason', l.status_reason,
    'company_id', c.id,
    'company_name', c.name
  ) into v_location
  from public.locations l
  join public.companies c on c.id = l.company_id
  where l.account_user_id = v_uid;

  return jsonb_build_object(
    'user_id', v_profile.id,
    'role', v_profile.role,
    'first_name', v_profile.first_name,
    'last_name', v_profile.last_name,
    'profile_complete', v_profile.first_name is not null and v_profile.last_name is not null,
    'no_show_count', v_profile.no_show_count,
    'blocked_until', v_profile.blocked_until,
    'is_blocked', coalesce(v_profile.blocked_until > now(), false),
    'location', v_location
  );
end;
$$;

comment on function public.get_my_account is
  'Konto-Übersicht: role (nutzer/standort/admin), Name, profile_complete, Sperre, location (bei Standort-Accounts, sonst null).';

-- ----------------------------------------------------------------------------
-- update_my_profile: Vor- und Nachname setzen
-- ----------------------------------------------------------------------------
create function public.update_my_profile(p_first_name text, p_last_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_profile public.profiles;
begin
  if char_length(v_first) not between 1 and 50 or char_length(v_last) not between 1 and 50 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Vor- und Nachname müssen 1–50 Zeichen lang sein.');
  end if;

  update public.profiles set first_name = v_first, last_name = v_last
  where id = v_uid
  returning * into v_profile;
  return v_profile;
end;
$$;

-- ----------------------------------------------------------------------------
-- claim_voucher: Code sichern. Atomar mit Zeilensperre auf dem Angebot.
-- ----------------------------------------------------------------------------
create function public.claim_voucher(p_offer_id uuid, p_seats integer default 1)
returns table (
  id uuid,
  offer_id uuid,
  seats integer,
  token text,
  short_code text,
  status public.voucher_status,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
  v_offer public.offers;
  v_location_status public.location_status;
  v_voucher public.vouchers;
  v_attempt integer := 0;
begin
  select * into v_profile from public.profiles p where p.id = v_uid;
  if not found or v_profile.role <> 'nutzer' then
    perform private.raise_error('NUR_NUTZER', 'Codes können nur Nutzerkonten holen.');
  end if;
  if v_profile.first_name is null or v_profile.last_name is null then
    perform private.raise_error('PROFIL_UNVOLLSTAENDIG', 'Bitte gib zuerst Vor- und Nachnamen an.');
  end if;
  if v_profile.blocked_until is not null and v_profile.blocked_until > now() then
    perform private.raise_error(
      'GESPERRT',
      'Dein Konto ist wegen verpasster Termine gesperrt bis '
        || to_char(v_profile.blocked_until at time zone 'Europe/Berlin', 'DD.MM.YYYY, HH24:MI') || ' Uhr.'
    );
  end if;
  if p_seats is null or p_seats < 1 then
    perform private.raise_error('UNGUELTIGE_PLATZANZAHL', 'Bitte mindestens einen Platz wählen.');
  end if;

  -- Zeilensperre: parallele Anfragen auf dasselbe Angebot warten hier aufeinander.
  select * into v_offer from public.offers o where o.id = p_offer_id for update;
  if not found then
    perform private.raise_error('ANGEBOT_NICHT_GEFUNDEN', 'Dieses Angebot gibt es nicht.');
  end if;

  select l.status into v_location_status from public.locations l where l.id = v_offer.location_id;
  if v_offer.status <> 'aktiv' or v_location_status <> 'approved' then
    perform private.raise_error('ANGEBOT_NICHT_AKTIV', 'Dieses Angebot ist nicht mehr verfügbar.');
  end if;
  if v_offer.type = 'einzeltermin' and now() >= v_offer.starts_at then
    perform private.raise_error('ANGEBOT_BEGONNEN', 'Der Termin hat schon begonnen.');
  end if;
  if v_offer.type = 'zeitraum' and now() >= v_offer.ends_at then
    perform private.raise_error('ANGEBOT_ABGELAUFEN', 'Der Zeitraum ist abgelaufen.');
  end if;
  if p_seats > v_offer.max_per_user then
    perform private.raise_error(
      'ZU_VIELE_PLAETZE',
      format('Pro Person sind höchstens %s Plätze möglich.', v_offer.max_per_user)
    );
  end if;
  if exists (
    select 1 from public.vouchers v
    where v.offer_id = p_offer_id and v.user_id = v_uid and v.status = 'aktiv'
  ) then
    perform private.raise_error('BEREITS_AKTIVER_CODE', 'Du hast für dieses Angebot schon einen Code.');
  end if;
  if v_offer.capacity - v_offer.seats_taken < p_seats then
    perform private.raise_error(
      'AUSGEBUCHT',
      case when v_offer.capacity - v_offer.seats_taken = 0
        then 'Leider sind alle Plätze vergeben.'
        else format('Es sind nur noch %s Plätze frei.', v_offer.capacity - v_offer.seats_taken)
      end
    );
  end if;

  update public.offers o set seats_taken = o.seats_taken + p_seats where o.id = p_offer_id;

  -- Kurzcode ist eindeutig; bei der (seltenen) Kollision neu würfeln.
  loop
    begin
      insert into public.vouchers (offer_id, user_id, seats, token, short_code)
      values (p_offer_id, v_uid, p_seats, private.generate_token(), private.generate_short_code())
      returning * into v_voucher;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  perform private.log_event('code_geholt', v_offer, v_uid, v_voucher.id, p_seats);

  return query select v_voucher.id, v_voucher.offer_id, v_voucher.seats, v_voucher.token,
    v_voucher.short_code, v_voucher.status, v_voucher.claimed_at;
end;
$$;

comment on function public.claim_voucher is
  'Code holen. Prüft Login, Rolle, Profil, Sperre, Angebotsstatus, Zeit, Plätze pro Person, einen aktiven Code pro Angebot und freie Plätze. Sperrt das Angebot (FOR UPDATE), überbucht nie.';

-- ----------------------------------------------------------------------------
-- cancel_voucher: eigenen Code stornieren, Plätze gehen zurück
-- Einzeltermin: nur bis cancel_deadline_hours vor Start. Zeitraum: jederzeit.
-- ----------------------------------------------------------------------------
create function public.cancel_voucher(p_voucher_id uuid)
returns table (
  id uuid,
  offer_id uuid,
  seats integer,
  status public.voucher_status,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
  v_offer_id uuid;
  v_offer public.offers;
  v_voucher public.vouchers;
  v_settings public.settings := private.get_settings();
begin
  select v.offer_id into v_offer_id from public.vouchers v
  where v.id = p_voucher_id and v.user_id = v_uid;
  if not found then
    perform private.raise_error('CODE_NICHT_GEFUNDEN', 'Diesen Code gibt es nicht.');
  end if;

  -- Sperrreihenfolge: Angebot, dann Code
  select * into v_offer from public.offers o where o.id = v_offer_id for update;
  select * into v_voucher from public.vouchers v where v.id = p_voucher_id for update;

  if v_voucher.status <> 'aktiv' then
    perform private.raise_error('CODE_NICHT_AKTIV', 'Dieser Code ist nicht mehr aktiv.');
  end if;
  if v_offer.type = 'einzeltermin'
    and now() > v_offer.starts_at - make_interval(hours => v_settings.cancel_deadline_hours) then
    perform private.raise_error(
      'FRIST_ABGELAUFEN',
      format('Stornieren ist nur bis %s Std. vor Beginn möglich.', v_settings.cancel_deadline_hours)
    );
  end if;
  if v_offer.type = 'zeitraum' and now() >= v_offer.ends_at then
    perform private.raise_error('ANGEBOT_ABGELAUFEN', 'Der Zeitraum ist abgelaufen.');
  end if;

  update public.vouchers v
  set status = 'storniert', cancelled_at = now(), cancel_reason = 'nutzer'
  where v.id = p_voucher_id
  returning * into v_voucher;

  update public.offers o set seats_taken = o.seats_taken - v_voucher.seats where o.id = v_offer.id;

  perform private.log_event('code_storniert', v_offer, v_uid, v_voucher.id, v_voucher.seats);

  return query select v_voucher.id, v_voucher.offer_id, v_voucher.seats, v_voucher.status, v_voucher.cancelled_at;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_my_vouchers: eigene Codes mit Angebotsinfos
-- Aktive zuerst (nach Relevanz), danach der Rest (neueste zuerst).
-- ----------------------------------------------------------------------------
create function public.get_my_vouchers()
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
    o.id, o.title, o.type, o.status, o.starts_at, o.ends_at, o.image_paths[1], o.address, o.lat, o.lng,
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

comment on function public.get_my_vouchers is
  'Eigene Codes inkl. Angebot, Standort, can_cancel und cancel_deadline. Aktive zuerst.';

-- ----------------------------------------------------------------------------
-- Push-Tokens: Gerät registrieren bzw. abmelden
-- Ein Token gehört immer dem zuletzt angemeldeten Konto auf dem Gerät.
-- ----------------------------------------------------------------------------
create function public.register_push_token(p_token text, p_platform public.push_platform)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if p_token is null or char_length(p_token) not between 1 and 500 or p_platform is null then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Ungültiger Push-Token.');
  end if;
  insert into public.push_tokens (user_id, token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- delete_my_account: Nutzerkonto löschen
-- Aktive Codes werden storniert (Plätze zurück). Codes und Events bleiben ohne
-- Personenbezug für Kennzahlen erhalten. Profil, Favoriten, Push-Tokens und
-- Benachrichtigungen werden gelöscht, zuletzt das Auth-Konto.
-- Hinweis für die App: danach signOut(), bestehende Tokens laufen sonst bis
-- zum Ablauf weiter, können aber nichts mehr tun (kein Profil).
-- ----------------------------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role public.app_role;
  v_item record;
  v_offer public.offers;
begin
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'nutzer' then
    perform private.raise_error(
      'KONTO_NICHT_LOESCHBAR',
      'Standort- und Admin-Konten können nur vom Admin gelöscht werden.'
    );
  end if;

  -- aktive Codes stornieren, Angebote in fester Reihenfolge sperren
  for v_item in
    select v.id, v.offer_id, v.seats from public.vouchers v
    where v.user_id = v_uid and v.status = 'aktiv'
    order by v.offer_id
  loop
    select * into v_offer from public.offers o where o.id = v_item.offer_id for update;
    update public.vouchers v
    set status = 'storniert', cancelled_at = now(), cancel_reason = 'konto_geloescht'
    where v.id = v_item.id;
    update public.offers o set seats_taken = o.seats_taken - v_item.seats where o.id = v_item.offer_id;
    perform private.log_event('code_storniert', v_offer, null, v_item.id, v_item.seats);
  end loop;

  -- Auth-Konto löschen: kaskadiert auf profiles → favorites, push_tokens,
  -- notification_outbox; vouchers.user_id und events.user_id werden null.
  delete from auth.users where id = v_uid;
end;
$$;

comment on function public.delete_my_account is
  'Löscht das eigene Nutzerkonto (nur Rolle nutzer). Storniert aktive Codes, anonymisiert Codes/Events, löscht Profil und Auth-Konto.';

-- ----------------------------------------------------------------------------
-- Rechte: nur für angemeldete Konten
-- ----------------------------------------------------------------------------
revoke all on function public.get_my_account() from public;
revoke all on function public.update_my_profile(text, text) from public;
revoke all on function public.claim_voucher(uuid, integer) from public;
revoke all on function public.cancel_voucher(uuid) from public;
revoke all on function public.get_my_vouchers() from public;
revoke all on function public.register_push_token(text, public.push_platform) from public;
revoke all on function public.unregister_push_token(text) from public;
revoke all on function public.delete_my_account() from public;

grant execute on function public.get_my_account() to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.claim_voucher(uuid, integer) to authenticated;
grant execute on function public.cancel_voucher(uuid) to authenticated;
grant execute on function public.get_my_vouchers() to authenticated;
grant execute on function public.register_push_token(text, public.push_platform) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
