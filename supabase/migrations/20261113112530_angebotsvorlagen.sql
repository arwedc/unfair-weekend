-- Angebotsvorlagen: Ein Standort legt sich Vorlagen an (z. B. „Kochkurs Standard“),
-- um bei einer kurzfristigen Auslastungslücke in Sekunden ein Angebot zu erstellen.
-- Eine Vorlage enthält alles außer dem konkreten Zeitpunkt: statt Beginn und Ende
-- nur die Dauer. Die Adresse kommt beim Anlegen des Angebots vom Standort.
-- Lesen über RLS (eigener Standort), Schreiben nur über RPCs.

-- ----------------------------------------------------------------------------
-- Tabelle
-- ----------------------------------------------------------------------------
create table public.offer_templates (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 10 and 2000),
  category public.offer_category not null,
  image_paths text[] not null default '{}' check (
    cardinality(image_paths) between 0 and 5
    and array_position(image_paths, null) is null
  ),
  original_price_cents integer not null check (original_price_cents between 1 and 10000000),
  deal_price_cents integer not null check (deal_price_cents >= 0),
  capacity integer not null check (capacity between 1 and 1000),
  max_per_user integer not null check (max_per_user between 1 and 20),
  type public.offer_type not null,
  duration_minutes integer not null check (duration_minutes between 1 and 129600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_templates_deal_below_original check (deal_price_cents < original_price_cents),
  constraint offer_templates_max_per_user_within_capacity check (max_per_user <= capacity),
  constraint offer_templates_name_unique unique (location_id, name)
);
comment on table public.offer_templates is
  'Vorlagen eines Standorts für neue Angebote. Schreiben nur über RPCs (create_/update_/delete_offer_template).';
comment on column public.offer_templates.name is
  'Interner Name der Vorlage, nur für den Standort sichtbar. Eindeutig je Standort.';
comment on column public.offer_templates.image_paths is
  '0–5 Storage-Pfade im Bucket offer-images (dieselben Dateien wie bei Angeboten).';
comment on column public.offer_templates.duration_minutes is
  'Dauer des Angebots in Minuten (Ende = Beginn + Dauer), höchstens 90 Tage.';

-- location_id (RLS und FK) ist über den Unique-Index (location_id, name) abgedeckt.

create trigger set_updated_at before update on public.offer_templates
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS und Rechte: Standort liest seine Vorlagen, Admin alle. Nutzer sehen nichts.
-- ----------------------------------------------------------------------------
alter table public.offer_templates enable row level security;

revoke all on table public.offer_templates from anon, authenticated;
grant select on table public.offer_templates to authenticated;

create policy "offer_templates: eigene lesen, Admin alle" on public.offer_templates
  for select to authenticated
  using (
    location_id = (select private.my_location_id())
    or (select private.is_admin())
  );

-- ----------------------------------------------------------------------------
-- Validierung (gleiche Grenzen wie bei Angeboten, ohne Zeitpunkt und Adresse)
-- ----------------------------------------------------------------------------
create function private.validate_offer_template_input(
  p_name text,
  p_title text,
  p_description text,
  p_category public.offer_category,
  p_image_paths text[],
  p_original_price_cents integer,
  p_deal_price_cents integer,
  p_capacity integer,
  p_max_per_user integer,
  p_type public.offer_type,
  p_duration_minutes integer
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
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 60 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Name der Vorlage: 2–60 Zeichen.');
  end if;
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
  if (p_original_price_cents - p_deal_price_cents) * 100 < v_min_discount * p_original_price_cents then
    perform private.raise_error('RABATT_ZU_GERING', format('Der Rabatt muss mindestens %s %% betragen.', v_min_discount));
  end if;
  if p_capacity is null or p_capacity not between 1 and 1000 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Kontingent: 1–1000 Plätze.');
  end if;
  if p_max_per_user is null or p_max_per_user not between 1 and 20 or p_max_per_user > p_capacity then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Plätze pro Person: 1–20 und höchstens das Kontingent.');
  end if;
  if p_type is null or p_duration_minutes is null or p_duration_minutes not between 1 and 129600 then
    perform private.raise_error('ZEIT_UNGUELTIG', 'Dauer: mindestens 1 Minute, höchstens 90 Tage.');
  end if;
end;
$$;

revoke all on function private.validate_offer_template_input(
  text, text, text, public.offer_category, text[], integer, integer, integer, integer,
  public.offer_type, integer
) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- create_offer_template
-- ----------------------------------------------------------------------------
create function public.create_offer_template(
  p_name text,
  p_title text,
  p_description text,
  p_category public.offer_category,
  p_image_paths text[],
  p_original_price_cents integer,
  p_deal_price_cents integer,
  p_capacity integer,
  p_max_per_user integer,
  p_type public.offer_type,
  p_duration_minutes integer
)
returns public.offer_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(true);
  v_template public.offer_templates;
begin
  perform private.validate_offer_template_input(
    p_name, p_title, p_description, p_category, p_image_paths, p_original_price_cents,
    p_deal_price_cents, p_capacity, p_max_per_user, p_type, p_duration_minutes
  );

  -- Sperrt den Standort, damit das Limit auch bei parallelen Aufrufen hält
  perform 1 from public.locations where id = v_location.id for update;
  if (select count(*) from public.offer_templates where location_id = v_location.id) >= 30 then
    perform private.raise_error('VORLAGEN_LIMIT', 'Es sind höchstens 30 Vorlagen möglich.');
  end if;
  if exists (
    select 1 from public.offer_templates
    where location_id = v_location.id and name = btrim(p_name)
  ) then
    perform private.raise_error('VORLAGENNAME_VERGEBEN', 'Eine Vorlage mit diesem Namen gibt es schon.');
  end if;

  insert into public.offer_templates (
    location_id, name, title, description, category, image_paths, original_price_cents,
    deal_price_cents, capacity, max_per_user, type, duration_minutes
  ) values (
    v_location.id, btrim(p_name), btrim(p_title), btrim(p_description), p_category,
    private.clean_image_paths(p_image_paths), p_original_price_cents, p_deal_price_cents,
    p_capacity, p_max_per_user, p_type, p_duration_minutes
  )
  returning * into v_template;

  return v_template;
end;
$$;

-- ----------------------------------------------------------------------------
-- update_offer_template
-- ----------------------------------------------------------------------------
create function public.update_offer_template(
  p_template_id uuid,
  p_name text,
  p_title text,
  p_description text,
  p_category public.offer_category,
  p_image_paths text[],
  p_original_price_cents integer,
  p_deal_price_cents integer,
  p_capacity integer,
  p_max_per_user integer,
  p_type public.offer_type,
  p_duration_minutes integer
)
returns public.offer_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(true);
  v_template public.offer_templates;
begin
  perform 1 from public.offer_templates
  where id = p_template_id and location_id = v_location.id
  for update;
  if not found then
    perform private.raise_error('VORLAGE_NICHT_GEFUNDEN', 'Diese Vorlage gibt es nicht.');
  end if;

  perform private.validate_offer_template_input(
    p_name, p_title, p_description, p_category, p_image_paths, p_original_price_cents,
    p_deal_price_cents, p_capacity, p_max_per_user, p_type, p_duration_minutes
  );

  if exists (
    select 1 from public.offer_templates
    where location_id = v_location.id and name = btrim(p_name) and id <> p_template_id
  ) then
    perform private.raise_error('VORLAGENNAME_VERGEBEN', 'Eine Vorlage mit diesem Namen gibt es schon.');
  end if;

  update public.offer_templates set
    name = btrim(p_name),
    title = btrim(p_title),
    description = btrim(p_description),
    category = p_category,
    image_paths = private.clean_image_paths(p_image_paths),
    original_price_cents = p_original_price_cents,
    deal_price_cents = p_deal_price_cents,
    capacity = p_capacity,
    max_per_user = p_max_per_user,
    type = p_type,
    duration_minutes = p_duration_minutes
  where id = p_template_id
  returning * into v_template;

  return v_template;
end;
$$;

-- ----------------------------------------------------------------------------
-- delete_offer_template: Angebote, die aus der Vorlage entstanden sind, bleiben.
-- ----------------------------------------------------------------------------
create function public.delete_offer_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(false);
begin
  delete from public.offer_templates
  where id = p_template_id and location_id = v_location.id;
  if not found then
    perform private.raise_error('VORLAGE_NICHT_GEFUNDEN', 'Diese Vorlage gibt es nicht.');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Rechte: nur angemeldete Konten (die Funktionen prüfen das Standortkonto selbst)
-- ----------------------------------------------------------------------------
revoke all on function public.create_offer_template(
  text, text, text, public.offer_category, text[], integer, integer, integer, integer,
  public.offer_type, integer
) from public, anon;
revoke all on function public.update_offer_template(
  uuid, text, text, text, public.offer_category, text[], integer, integer, integer, integer,
  public.offer_type, integer
) from public, anon;
revoke all on function public.delete_offer_template(uuid) from public, anon;

grant execute on function public.create_offer_template(
  text, text, text, public.offer_category, text[], integer, integer, integer, integer,
  public.offer_type, integer
) to authenticated;
grant execute on function public.update_offer_template(
  uuid, text, text, text, public.offer_category, text[], integer, integer, integer, integer,
  public.offer_type, integer
) to authenticated;
grant execute on function public.delete_offer_template(uuid) to authenticated;
