-- Bilder bei Angeboten werden optional: 0 bis 5 statt 1 bis 5.
-- Ohne Bild ist image_paths ein leeres Array (nie NULL), cover_image_path in
-- den Feed-RPCs ist dann NULL. Die Clients zeigen dafür einen Platzhalter.
-- NULL als Eingabe zählt wie ein leeres Array.

-- ----------------------------------------------------------------------------
-- Check-Constraint auf offers.image_paths
-- ----------------------------------------------------------------------------
alter table public.offers drop constraint offers_image_paths_check;
alter table public.offers add constraint offers_image_paths_check check (
  cardinality(image_paths) between 0 and 5
  and array_position(image_paths, null) is null
);
alter table public.offers alter column image_paths set default '{}';

comment on column public.offers.image_paths is
  '0–5 Storage-Pfade im Bucket offer-images, das erste ist das Titelbild. Leeres Array = kein Bild.';

-- ----------------------------------------------------------------------------
-- Validierung: 0–5 Bilder, jeder Eintrag 1–500 Zeichen
-- ----------------------------------------------------------------------------
create or replace function private.validate_offer_input(
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
  if cardinality(coalesce(p_image_paths, '{}')) > 5
    or exists (select 1 from unnest(p_image_paths) as path where path is null or char_length(btrim(path)) not between 1 and 500)
  then
    perform private.raise_error('BILDER_UNGUELTIG', 'Höchstens 5 Bilder.');
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
-- Bildpfade bereinigen: getrimmt, Reihenfolge bleibt, leer statt NULL
-- ----------------------------------------------------------------------------
create function private.clean_image_paths(p_image_paths text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select array_agg(btrim(path) order by ord) from unnest(p_image_paths) with ordinality as t(path, ord)),
    '{}'
  );
$$;

-- ----------------------------------------------------------------------------
-- create_offer: unverändert bis auf private.clean_image_paths
-- ----------------------------------------------------------------------------
create or replace function public.create_offer(
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
    private.clean_image_paths(p_image_paths),
    p_original_price_cents, p_deal_price_cents, p_capacity, p_max_per_user, btrim(p_address),
    p_lat, p_lng, p_type, p_starts_at, p_ends_at, v_location.account_user_id
  )
  returning * into v_offer;
  return v_offer;
end;
$$;

-- ----------------------------------------------------------------------------
-- update_offer: unverändert bis auf private.clean_image_paths
-- ----------------------------------------------------------------------------
create or replace function public.update_offer(
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
      image_paths = private.clean_image_paths(p_image_paths),
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
