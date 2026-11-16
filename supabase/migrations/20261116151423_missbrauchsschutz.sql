-- ============================================================================
-- Missbrauchsschutz
--
-- 1. claim_voucher: Obergrenze für gleichzeitig aktive Codes pro Nutzer und
--    für geholte Codes pro 24 Stunden. Sonst kann ein Konto Plätze in allen
--    Angeboten blockieren und kurz vor der Frist stornieren.
-- 2. log_offer_view: Aufrufe ohne Login zählen pro Angebot höchstens 120-mal
--    pro Stunde. Sonst lässt sich die Tabelle events ohne Konto beliebig füllen.
-- 3. Storage: Standorte, die noch nicht freigeschaltet sind, dürfen nur wenige
--    Dateien hochladen (10 Bilder, 5 Logos). Hochladen vor der Freischaltung
--    bleibt möglich, die Registrierung braucht das.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Limits für Codes
-- ----------------------------------------------------------------------------
alter table public.settings
  add column max_active_vouchers integer not null default 5
    check (max_active_vouchers between 1 and 100),
  add column max_claims_per_day integer not null default 10
    check (max_claims_per_day between 1 and 1000);

comment on column public.settings.max_active_vouchers is 'So viele aktive Codes darf ein Nutzer gleichzeitig haben.';
comment on column public.settings.max_claims_per_day is 'So viele Codes darf ein Nutzer in 24 Stunden holen (stornierte zählen mit).';

create or replace function public.claim_voucher(p_offer_id uuid, p_seats integer default 1)
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
  v_settings public.settings := private.get_settings();
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

  -- Limits pro Nutzer. Die Profilsperre (nach dem Angebot, siehe Sperrreihenfolge)
  -- verhindert, dass parallele Anfragen auf verschiedene Angebote das Limit umgehen.
  perform 1 from public.profiles p where p.id = v_uid for update;
  if (
    select count(*) from public.vouchers v where v.user_id = v_uid and v.status = 'aktiv'
  ) >= v_settings.max_active_vouchers then
    perform private.raise_error(
      'ZU_VIELE_AKTIVE_CODES',
      format('Du kannst höchstens %s aktive Codes gleichzeitig haben.', v_settings.max_active_vouchers)
    );
  end if;
  if (
    select count(*) from public.vouchers v
    where v.user_id = v_uid and v.claimed_at > now() - interval '24 hours'
  ) >= v_settings.max_claims_per_day then
    perform private.raise_error(
      'TAGESLIMIT_ERREICHT',
      format('Du kannst höchstens %s Codes in 24 Stunden holen. Versuch es später noch einmal.', v_settings.max_claims_per_day)
    );
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
  'Code holen. Prüft Login, Rolle, Profil, Sperre, Angebotsstatus, Zeit, Plätze pro Person, einen aktiven Code pro Angebot, die Limits pro Nutzer (aktive Codes, Codes pro 24 Std.) und freie Plätze. Sperrt das Angebot (FOR UPDATE), überbucht nie.';

-- ----------------------------------------------------------------------------
-- 2. Aufrufe ohne Login deckeln
-- ----------------------------------------------------------------------------
create index events_anonymous_views_idx
  on public.events (offer_id, created_at)
  where type = 'angebot_angesehen' and user_id is null;

create or replace function public.log_offer_view(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_offer public.offers;
begin
  select o.* into v_offer
  from public.offers o
  join public.locations l on l.id = o.location_id
  where o.id = p_offer_id and o.status = 'aktiv' and l.status = 'approved';
  if not found then
    return;
  end if;

  if v_uid is not null and exists (
    select 1 from public.events e
    where e.type = 'angebot_angesehen' and e.offer_id = p_offer_id and e.user_id = v_uid
      and e.created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  -- Ohne Login gibt es keinen Nutzer zum Entdoppeln: pro Angebot höchstens 120 pro Stunde.
  if v_uid is null and (
    select count(*) from public.events e
    where e.type = 'angebot_angesehen' and e.offer_id = p_offer_id and e.user_id is null
      and e.created_at > now() - interval '1 hour'
  ) >= 120 then
    return;
  end if;

  perform private.log_event('angebot_angesehen', v_offer, v_uid);
end;
$$;

comment on function public.log_offer_view is
  'Zählt einen Aufruf der Detailseite (für Kennzahlen). Auch ohne Login, dann höchstens 120 pro Angebot und Stunde. Wirft keine Fehler.';

-- ----------------------------------------------------------------------------
-- 3. Upload-Obergrenze vor der Freischaltung
--
-- Zusätzliche, einschränkende Policy: Die bestehenden Ordner-Policies bleiben
-- unverändert und müssen weiterhin erfüllt sein. Freigeschaltete Standorte und
-- Admins sind nicht begrenzt, andere Buckets (avatars) sind nicht betroffen.
-- ----------------------------------------------------------------------------
create function private.upload_within_limit(p_bucket text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_location public.locations;
  v_folder text;
  v_limit integer;
begin
  select * into v_location from public.locations l where l.account_user_id = (select auth.uid());
  if not found then
    -- kein Standortkonto: Ob überhaupt hochgeladen werden darf, entscheiden die Ordner-Policies
    return true;
  end if;
  if v_location.status = 'approved' then
    return true;
  end if;

  if p_bucket = 'offer-images' then
    v_folder := v_location.id::text;
    v_limit := 10;
  else
    v_folder := v_location.company_id::text;
    v_limit := 5;
  end if;

  return (
    select count(*) from storage.objects o
    where o.bucket_id = p_bucket and (storage.foldername(o.name))[1] = v_folder
  ) < v_limit;
end;
$$;

revoke all on function private.upload_within_limit(text) from public;
grant execute on function private.upload_within_limit(text) to authenticated;

create policy "Bilder und Logos: Obergrenze vor der Freischaltung" on storage.objects
  as restrictive
  for insert to authenticated
  with check (
    bucket_id not in ('offer-images', 'company-logos')
    or (select private.is_admin())
    or private.upload_within_limit(bucket_id)
  );
