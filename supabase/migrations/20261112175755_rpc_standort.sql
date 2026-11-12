-- ============================================================================
-- RPCs für Standort-Accounts (Website)
-- Registrierung, Stammdaten, Angebote, Einlösen, No-Show, Teilnehmerliste
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Validierung der Standort-Stammdaten
-- ----------------------------------------------------------------------------
create function private.validate_location_input(
  p_name text,
  p_street text,
  p_postal_code text,
  p_city text,
  p_lat double precision,
  p_lng double precision,
  p_phone text,
  p_website text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 100 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Standortname: 2–100 Zeichen.');
  end if;
  if char_length(btrim(coalesce(p_street, ''))) not between 2 and 120 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Straße und Hausnummer: 2–120 Zeichen.');
  end if;
  if coalesce(p_postal_code, '') !~ '^[0-9]{5}$' then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Die Postleitzahl muss 5 Ziffern haben.');
  end if;
  if char_length(btrim(coalesce(p_city, ''))) not between 2 and 80 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Ort: 2–80 Zeichen.');
  end if;
  if (p_lat is null) <> (p_lng is null)
    or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Ungültige Koordinaten.');
  end if;
  if p_phone is not null and char_length(p_phone) > 40 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Telefon: höchstens 40 Zeichen.');
  end if;
  if p_website is not null and char_length(p_website) > 300 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Website: höchstens 300 Zeichen.');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- register_company: Unternehmen + ersten Standort anlegen (Status pending)
-- Voraussetzung: Konto wurde mit options.data.account_type = 'standort'
-- registriert (Rolle standort) und hat noch keinen Standort.
-- ----------------------------------------------------------------------------
create function public.register_company(
  p_company_name text,
  p_location_name text,
  p_street text,
  p_postal_code text,
  p_city text,
  p_company_description text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_phone text default null,
  p_website text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role public.app_role;
  v_company_id uuid;
  v_location_id uuid;
begin
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'standort' then
    perform private.raise_error(
      'KEIN_STANDORTKONTO',
      'Bitte registriere dich als Unternehmen (Konto vom Typ Standort).'
    );
  end if;
  if exists (select 1 from public.locations l where l.account_user_id = v_uid) then
    perform private.raise_error('STANDORT_EXISTIERT_BEREITS', 'Zu diesem Konto gibt es schon einen Standort.');
  end if;
  if char_length(btrim(coalesce(p_company_name, ''))) not between 2 and 100 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Unternehmensname: 2–100 Zeichen.');
  end if;
  if p_company_description is not null and char_length(p_company_description) > 2000 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Beschreibung: höchstens 2000 Zeichen.');
  end if;
  perform private.validate_location_input(
    p_location_name, p_street, p_postal_code, p_city, p_lat, p_lng, p_phone, p_website
  );

  insert into public.companies (name, description)
  values (btrim(p_company_name), nullif(btrim(p_company_description), ''))
  returning id into v_company_id;

  insert into public.locations (
    company_id, account_user_id, name, street, postal_code, city, lat, lng, phone, website
  )
  values (
    v_company_id, v_uid, btrim(p_location_name), btrim(p_street), p_postal_code, btrim(p_city),
    p_lat, p_lng, nullif(btrim(p_phone), ''), nullif(btrim(p_website), '')
  )
  returning id into v_location_id;

  return jsonb_build_object('company_id', v_company_id, 'location_id', v_location_id, 'status', 'pending');
end;
$$;

comment on function public.register_company is
  'Selbstregistrierung: legt Unternehmen und ersten Standort (pending) für das angemeldete Standort-Konto an.';

-- ----------------------------------------------------------------------------
-- update_my_location / update_my_company: Stammdaten pflegen (auch pending)
-- ----------------------------------------------------------------------------
create function public.update_my_location(
  p_name text,
  p_street text,
  p_postal_code text,
  p_city text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_phone text default null,
  p_website text default null
)
returns public.locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(false);
begin
  perform private.validate_location_input(
    p_name, p_street, p_postal_code, p_city, p_lat, p_lng, p_phone, p_website
  );
  update public.locations
  set name = btrim(p_name), street = btrim(p_street), postal_code = p_postal_code, city = btrim(p_city),
      lat = p_lat, lng = p_lng, phone = nullif(btrim(p_phone), ''), website = nullif(btrim(p_website), '')
  where id = v_location.id
  returning * into v_location;
  return v_location;
end;
$$;

create function public.update_my_company(
  p_name text,
  p_description text default null,
  p_logo_path text default null
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(false);
  v_company public.companies;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 100 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Unternehmensname: 2–100 Zeichen.');
  end if;
  if p_description is not null and char_length(p_description) > 2000 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Beschreibung: höchstens 2000 Zeichen.');
  end if;
  if p_logo_path is not null and char_length(p_logo_path) > 500 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Logo-Pfad: höchstens 500 Zeichen.');
  end if;
  update public.companies
  set name = btrim(p_name), description = nullif(btrim(p_description), ''), logo_path = nullif(p_logo_path, '')
  where id = v_location.company_id
  returning * into v_company;
  return v_company;
end;
$$;

-- ----------------------------------------------------------------------------
-- Validierung der Angebotsdaten (gemeinsam für create_offer und update_offer)
-- ----------------------------------------------------------------------------
create function private.validate_offer_input(
  p_title text,
  p_description text,
  p_category public.offer_category,
  p_image_paths text[],
  p_original_price_cents integer,
  p_deal_price_cents integer,
  p_capacity integer,
  p_max_per_user integer,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_type public.offer_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_check_discount boolean,
  p_check_future boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_min_discount integer := (private.get_settings()).min_discount_percent;
begin
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 80 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Titel: 3–80 Zeichen.');
  end if;
  if char_length(btrim(coalesce(p_description, ''))) not between 10 and 2000 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Beschreibung: 10–2000 Zeichen.');
  end if;
  if p_category is null then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Bitte eine Kategorie wählen.');
  end if;
  if p_image_paths is null
    or cardinality(p_image_paths) not between 1 and 5
    or exists (select 1 from unnest(p_image_paths) as path where path is null or char_length(btrim(path)) not between 1 and 500)
  then
    perform private.raise_error('BILDER_UNGUELTIG', 'Bitte 1 bis 5 Bilder angeben.');
  end if;
  if p_original_price_cents is null or p_original_price_cents not between 1 and 10000000
    or p_deal_price_cents is null or p_deal_price_cents < 0
    or p_deal_price_cents >= p_original_price_cents
  then
    perform private.raise_error('PREIS_UNGUELTIG', 'Der Deal-Preis muss unter dem Originalpreis liegen.');
  end if;
  if p_check_discount
    and (p_original_price_cents - p_deal_price_cents) * 100 < v_min_discount * p_original_price_cents
  then
    perform private.raise_error('RABATT_ZU_GERING', format('Der Rabatt muss mindestens %s %% betragen.', v_min_discount));
  end if;
  if p_capacity is null or p_capacity not between 1 and 1000 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Kontingent: 1–1000 Plätze.');
  end if;
  if p_max_per_user is null or p_max_per_user not between 1 and 20 or p_max_per_user > p_capacity then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Plätze pro Person: 1–20 und höchstens das Kontingent.');
  end if;
  if char_length(btrim(coalesce(p_address, ''))) not between 5 and 200
    or p_lat is null or p_lng is null
    or p_lat not between -90 and 90 or p_lng not between -180 and 180
  then
    perform private.raise_error('ADRESSE_UNGUELTIG', 'Bitte eine Adresse mit Koordinaten angeben.');
  end if;
  if p_type is null or p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    perform private.raise_error('ZEIT_UNGUELTIG', 'Das Ende muss nach dem Beginn liegen.');
  end if;
  if p_ends_at - p_starts_at > interval '90 days' or p_starts_at > now() + interval '1 year' then
    perform private.raise_error('ZEIT_UNGUELTIG', 'Höchstens 90 Tage Dauer und Beginn innerhalb eines Jahres.');
  end if;
  if p_check_future and (
    (p_type = 'einzeltermin' and p_starts_at <= now())
    or (p_type = 'zeitraum' and p_ends_at <= now())
  ) then
    perform private.raise_error('ZEIT_IN_VERGANGENHEIT', 'Der Zeitpunkt liegt in der Vergangenheit.');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- create_offer: Angebot anlegen, sofort live
-- ----------------------------------------------------------------------------
create function public.create_offer(
  p_title text,
  p_description text,
  p_category public.offer_category,
  p_image_paths text[],
  p_original_price_cents integer,
  p_deal_price_cents integer,
  p_capacity integer,
  p_max_per_user integer,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_type public.offer_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(true);
  v_offer public.offers;
begin
  perform private.validate_offer_input(
    p_title, p_description, p_category, p_image_paths, p_original_price_cents, p_deal_price_cents,
    p_capacity, p_max_per_user, p_address, p_lat, p_lng, p_type, p_starts_at, p_ends_at,
    true, true
  );

  insert into public.offers (
    location_id, title, description, category, image_paths, original_price_cents, deal_price_cents,
    capacity, max_per_user, address, lat, lng, type, starts_at, ends_at, created_by
  )
  values (
    v_location.id, btrim(p_title), btrim(p_description), p_category,
    (select array_agg(btrim(path) order by ord) from unnest(p_image_paths) with ordinality as t(path, ord)),
    p_original_price_cents, p_deal_price_cents, p_capacity, p_max_per_user, btrim(p_address),
    p_lat, p_lng, p_type, p_starts_at, p_ends_at, v_location.account_user_id
  )
  returning * into v_offer;
  return v_offer;
end;
$$;

comment on function public.create_offer is
  'Neues Angebot des eigenen (freigeschalteten) Standorts. Prüft alle Regeln inkl. Mindestrabatt. Sofort live.';

-- ----------------------------------------------------------------------------
-- update_offer: Angebot ändern (alle Felder werden übergeben)
-- Nach Code-Vergabe gesperrt: Art, Zeit, Adresse/Koordinaten, Preise.
-- Kontingent darf nicht unter die vergebenen Plätze sinken.
-- ----------------------------------------------------------------------------
create function public.update_offer(
  p_offer_id uuid,
  p_title text,
  p_description text,
  p_category public.offer_category,
  p_image_paths text[],
  p_original_price_cents integer,
  p_deal_price_cents integer,
  p_capacity integer,
  p_max_per_user integer,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_type public.offer_type,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(true);
  v_offer public.offers;
  v_prices_changed boolean;
  v_times_changed boolean;
  v_place_changed boolean;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_offer.location_id <> v_location.id then
    perform private.raise_error('ANGEBOT_NICHT_GEFUNDEN', 'Dieses Angebot gibt es nicht.');
  end if;
  if v_offer.status <> 'aktiv' then
    perform private.raise_error('ANGEBOT_NICHT_AKTIV', 'Abgesagte oder entfernte Angebote können nicht geändert werden.');
  end if;

  v_prices_changed := p_original_price_cents is distinct from v_offer.original_price_cents
    or p_deal_price_cents is distinct from v_offer.deal_price_cents;
  v_times_changed := p_type is distinct from v_offer.type
    or p_starts_at is distinct from v_offer.starts_at
    or p_ends_at is distinct from v_offer.ends_at;
  v_place_changed := btrim(p_address) is distinct from v_offer.address
    or p_lat is distinct from v_offer.lat
    or p_lng is distinct from v_offer.lng;

  if (v_prices_changed or v_times_changed or v_place_changed) and private.offer_has_codes(p_offer_id) then
    perform private.raise_error(
      'FELD_GESPERRT',
      'Es gibt schon Codes für dieses Angebot. Zeit, Adresse und Preise sind deshalb gesperrt.'
    );
  end if;

  perform private.validate_offer_input(
    p_title, p_description, p_category, p_image_paths, p_original_price_cents, p_deal_price_cents,
    p_capacity, p_max_per_user, p_address, p_lat, p_lng, p_type, p_starts_at, p_ends_at,
    v_prices_changed, v_times_changed
  );

  if p_capacity < v_offer.seats_taken then
    perform private.raise_error(
      'KONTINGENT_ZU_KLEIN',
      format('Es sind schon %s Plätze vergeben. Das Kontingent kann nicht darunter sinken.', v_offer.seats_taken)
    );
  end if;

  update public.offers
  set title = btrim(p_title),
      description = btrim(p_description),
      category = p_category,
      image_paths = (select array_agg(btrim(path) order by ord) from unnest(p_image_paths) with ordinality as t(path, ord)),
      original_price_cents = p_original_price_cents,
      deal_price_cents = p_deal_price_cents,
      capacity = p_capacity,
      max_per_user = p_max_per_user,
      address = btrim(p_address),
      lat = p_lat,
      lng = p_lng,
      type = p_type,
      starts_at = p_starts_at,
      ends_at = p_ends_at
  where id = p_offer_id
  returning * into v_offer;
  return v_offer;
end;
$$;

comment on function public.update_offer is
  'Ändert ein eigenes, aktives Angebot. Titel, Beschreibung, Bilder, Kategorie, Plätze pro Person: immer. Kontingent: nicht unter vergebene Plätze. Art, Zeit, Adresse, Preise: nur solange keine Codes existieren.';

-- ----------------------------------------------------------------------------
-- cancel_offer: Angebot absagen. Alle aktiven Codes werden storniert (keine
-- No-Shows), jeder Inhaber bekommt einen Eintrag in notification_outbox.
-- ----------------------------------------------------------------------------
create function public.cancel_offer(p_offer_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(false);
  v_offer public.offers;
  v_count integer;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_offer.location_id <> v_location.id then
    perform private.raise_error('ANGEBOT_NICHT_GEFUNDEN', 'Dieses Angebot gibt es nicht.');
  end if;
  if v_offer.status <> 'aktiv' then
    perform private.raise_error('ANGEBOT_NICHT_AKTIV', 'Das Angebot ist bereits abgesagt oder entfernt.');
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Begründung: höchstens 500 Zeichen.');
  end if;

  update public.offers
  set status = 'abgesagt', status_reason = nullif(btrim(p_reason), ''), status_changed_at = now(),
      status_changed_by = v_location.account_user_id
  where id = p_offer_id;

  v_count := private.cancel_active_vouchers(p_offer_id, 'angebot_abgesagt', nullif(btrim(p_reason), ''));

  return jsonb_build_object('offer_id', p_offer_id, 'status', 'abgesagt', 'cancelled_vouchers', v_count);
end;
$$;

-- ----------------------------------------------------------------------------
-- redeem_voucher: Code einlösen (QR-Token oder Kurzcode)
-- Nur der eigene Standort. Einzeltermin: ab 1 Std. vor Start bis Ende.
-- Zeitraum: innerhalb des Zeitraums.
-- ----------------------------------------------------------------------------
create function public.redeem_voucher(p_code text)
returns table (
  id uuid,
  short_code text,
  seats integer,
  status public.voucher_status,
  redeemed_at timestamptz,
  offer_id uuid,
  offer_title text,
  first_name text,
  last_initial text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_location public.locations := private.require_location(true);
  v_short text := private.normalize_short_code(p_code);
  v_voucher_id uuid;
  v_voucher public.vouchers;
  v_offer public.offers;
  v_first text;
  v_last text;
begin
  if v_short is not null then
    select v.id into v_voucher_id from public.vouchers v where v.short_code = v_short;
  else
    select v.id into v_voucher_id from public.vouchers v where v.token = btrim(coalesce(p_code, ''));
  end if;
  if v_voucher_id is null then
    perform private.raise_error('CODE_NICHT_GEFUNDEN', 'Diesen Code gibt es nicht.');
  end if;

  select * into v_voucher from public.vouchers v where v.id = v_voucher_id for update;
  select * into v_offer from public.offers o where o.id = v_voucher.offer_id;

  if v_offer.location_id <> v_location.id then
    perform private.raise_error('FALSCHER_STANDORT', 'Dieser Code gehört zu einem anderen Standort.');
  end if;
  if v_voucher.status = 'eingeloest' then
    perform private.raise_error(
      'BEREITS_EINGELOEST',
      'Dieser Code wurde bereits am '
        || to_char(v_voucher.redeemed_at at time zone 'Europe/Berlin', 'DD.MM.YYYY "um" HH24:MI') || ' Uhr eingelöst.'
    );
  end if;
  if v_voucher.status <> 'aktiv' or v_offer.status <> 'aktiv' then
    perform private.raise_error('CODE_NICHT_AKTIV', 'Dieser Code ist nicht mehr gültig.');
  end if;
  if (v_offer.type = 'einzeltermin' and now() < v_offer.starts_at - interval '1 hour')
    or (v_offer.type = 'zeitraum' and now() < v_offer.starts_at) then
    perform private.raise_error(
      'EINLOESUNG_ZU_FRUEH',
      case when v_offer.type = 'einzeltermin'
        then 'Einlösen ist ab 1 Std. vor Beginn möglich.'
        else 'Der Zeitraum hat noch nicht begonnen.'
      end
    );
  end if;
  if now() > v_offer.ends_at then
    perform private.raise_error('EINLOESUNG_ZU_SPAET', 'Das Angebot ist bereits vorbei.');
  end if;

  update public.vouchers v
  set status = 'eingeloest', redeemed_at = now(), redeemed_by = v_location.account_user_id
  where v.id = v_voucher.id
  returning * into v_voucher;

  perform private.log_event('code_eingeloest', v_offer, v_voucher.user_id, v_voucher.id, v_voucher.seats);

  select p.first_name, p.last_name into v_first, v_last from public.profiles p where p.id = v_voucher.user_id;

  return query select v_voucher.id, v_voucher.short_code, v_voucher.seats, v_voucher.status,
    v_voucher.redeemed_at, v_offer.id, v_offer.title,
    coalesce(v_first, 'Gelöschtes Konto'), left(v_last, 1);
end;
$$;

comment on function public.redeem_voucher is
  'Löst einen Code ein (QR-Token oder Kurzcode, Groß/Klein und Bindestrich egal). Nur eigener Standort, nur im Einlösezeitraum.';

-- ----------------------------------------------------------------------------
-- mark_no_show: Einzeltermin, Code nicht erschienen
-- Ab Start bis 48 Std. nach Ende. Nach N No-Shows Sperre für D Tage,
-- danach beginnt der Zähler von vorn.
-- ----------------------------------------------------------------------------
create function public.mark_no_show(p_voucher_id uuid)
returns table (
  id uuid,
  status public.voucher_status,
  no_show_at timestamptz,
  user_blocked boolean,
  blocked_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_location public.locations := private.require_location(true);
  v_settings public.settings := private.get_settings();
  v_voucher public.vouchers;
  v_offer public.offers;
  v_profile public.profiles;
  v_blocked boolean := false;
begin
  select * into v_voucher from public.vouchers v where v.id = p_voucher_id;
  if found then
    select * into v_offer from public.offers o where o.id = v_voucher.offer_id;
  end if;
  if v_voucher.id is null or v_offer.location_id <> v_location.id then
    perform private.raise_error('CODE_NICHT_GEFUNDEN', 'Diesen Code gibt es nicht.');
  end if;
  if v_offer.type <> 'einzeltermin' then
    perform private.raise_error('NO_SHOW_NUR_EINZELTERMIN', 'No-Shows gibt es nur bei Einzelterminen.');
  end if;

  select * into v_voucher from public.vouchers v where v.id = p_voucher_id for update;
  if v_voucher.status <> 'aktiv' then
    perform private.raise_error('CODE_NICHT_AKTIV', 'Dieser Code ist nicht mehr aktiv.');
  end if;
  if now() < v_offer.starts_at then
    perform private.raise_error('NO_SHOW_ZU_FRUEH', 'No-Show erst ab Beginn des Termins.');
  end if;
  if now() > v_offer.ends_at + interval '48 hours' then
    perform private.raise_error('NO_SHOW_ZU_SPAET', 'No-Show nur bis 48 Std. nach Ende möglich.');
  end if;

  update public.vouchers v
  set status = 'no_show', no_show_at = now(), no_show_by = v_location.account_user_id
  where v.id = p_voucher_id
  returning * into v_voucher;

  perform private.log_event('no_show', v_offer, v_voucher.user_id, v_voucher.id, v_voucher.seats);

  if v_voucher.user_id is not null then
    select * into v_profile from public.profiles p where p.id = v_voucher.user_id for update;
    if v_profile.no_show_count + 1 >= v_settings.no_show_limit then
      update public.profiles p
      set no_show_count = 0, blocked_until = now() + make_interval(days => v_settings.block_days)
      where p.id = v_profile.id
      returning * into v_profile;
      v_blocked := true;
    else
      update public.profiles p set no_show_count = p.no_show_count + 1
      where p.id = v_profile.id
      returning * into v_profile;
    end if;
  end if;

  return query select v_voucher.id, v_voucher.status, v_voucher.no_show_at, v_blocked,
    case when v_blocked then v_profile.blocked_until end;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_offer_participants: Teilnehmerliste (ohne E-Mail)
-- Vorname, Initial des Nachnamens, Plätze, Kurzcode, Status
-- ----------------------------------------------------------------------------
create function public.get_offer_participants(p_offer_id uuid)
returns table (
  voucher_id uuid,
  short_code text,
  seats integer,
  status public.voucher_status,
  claimed_at timestamptz,
  redeemed_at timestamptz,
  no_show_at timestamptz,
  first_name text,
  last_initial text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
begin
  if not exists (
    select 1 from public.offers o
    join public.locations l on l.id = o.location_id
    where o.id = p_offer_id and (l.account_user_id = v_uid or private.is_admin())
  ) then
    perform private.raise_error('ANGEBOT_NICHT_GEFUNDEN', 'Dieses Angebot gibt es nicht.');
  end if;

  return query
  select v.id, v.short_code, v.seats, v.status, v.claimed_at, v.redeemed_at, v.no_show_at,
    coalesce(p.first_name, 'Gelöschtes Konto'), left(p.last_name, 1)
  from public.vouchers v
  left join public.profiles p on p.id = v.user_id
  where v.offer_id = p_offer_id
  order by (v.status = 'aktiv') desc, p.first_name nulls last, v.claimed_at;
end;
$$;

comment on function public.get_offer_participants is
  'Teilnehmerliste eines eigenen Angebots (oder für Admins): Vorname, Initial, Plätze, Kurzcode, Status. Keine E-Mail.';

-- ----------------------------------------------------------------------------
-- Rechte
-- ----------------------------------------------------------------------------
revoke all on function public.register_company(text, text, text, text, text, text, double precision, double precision, text, text) from public;
revoke all on function public.update_my_location(text, text, text, text, double precision, double precision, text, text) from public;
revoke all on function public.update_my_company(text, text, text) from public;
revoke all on function public.create_offer(text, text, public.offer_category, text[], integer, integer, integer, integer, text, double precision, double precision, public.offer_type, timestamptz, timestamptz) from public;
revoke all on function public.update_offer(uuid, text, text, public.offer_category, text[], integer, integer, integer, integer, text, double precision, double precision, public.offer_type, timestamptz, timestamptz) from public;
revoke all on function public.cancel_offer(uuid, text) from public;
revoke all on function public.redeem_voucher(text) from public;
revoke all on function public.mark_no_show(uuid) from public;
revoke all on function public.get_offer_participants(uuid) from public;

grant execute on function public.register_company(text, text, text, text, text, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.update_my_location(text, text, text, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.update_my_company(text, text, text) to authenticated;
grant execute on function public.create_offer(text, text, public.offer_category, text[], integer, integer, integer, integer, text, double precision, double precision, public.offer_type, timestamptz, timestamptz) to authenticated;
grant execute on function public.update_offer(uuid, text, text, public.offer_category, text[], integer, integer, integer, integer, text, double precision, double precision, public.offer_type, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancel_offer(uuid, text) to authenticated;
grant execute on function public.redeem_voucher(text) to authenticated;
grant execute on function public.mark_no_show(uuid) to authenticated;
grant execute on function public.get_offer_participants(uuid) to authenticated;
