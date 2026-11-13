-- Nutzerregistrierung mit E-Mail, Passwort und eindeutigem Nutzernamen.
-- Alter und Interessen sind optionale Angaben; Interessen nutzen die vorhandenen
-- Favoriten-Kategorien, damit sie auch in der Feed-Personalisierung funktionieren.

alter table public.profiles
  add column username text,
  add column age smallint,
  add constraint profiles_username_format_check
    check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  add constraint profiles_age_check
    check (age is null or age between 1 and 120);

create unique index profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

comment on column public.profiles.username is
  'Eindeutiger Nutzername aus der Registrierung; bei älteren OAuth-Konten optional.';
comment on column public.profiles.age is
  'Optionales Alter aus der Registrierung, ohne Geburtsdatum.';

-- Verfügbarkeit vor der Registrierung anzeigen. Der Unique-Index bleibt die
-- maßgebliche Absicherung gegen zwei gleichzeitige Registrierungen.
create function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(lower(btrim(p_username)), '') ~ '^[a-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(btrim(p_username))
    ),
    false
  );
$$;

comment on function public.is_username_available(text) is
  'Prüft, ob ein Nutzername dem Registrierungsformat entspricht und noch frei ist.';
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Profiltrigger um Registrierungsdaten erweitern. OAuth- und Standortkonten
-- ohne diese Metadaten bleiben gültig; Admin-Rechte kommen weiterhin nie aus Metadaten.
create or replace function private.handle_new_user()
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
  v_username text := nullif(lower(btrim(coalesce(v_meta ->> 'username', ''))), '');
  v_age_raw text := nullif(btrim(coalesce(v_meta ->> 'age', '')), '');
  v_age smallint;
  v_interest text;
begin
  if v_first is null and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last := coalesce(v_last, nullif(btrim(substr(v_full, char_length(v_first) + 2)), ''));
  end if;

  if v_username is not null and v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception using errcode = '23514', message = 'UNGUELTIGER_NUTZERNAME';
  end if;

  if v_age_raw is not null then
    if v_age_raw !~ '^[0-9]{1,3}$' then
      raise exception using errcode = '23514', message = 'UNGUELTIGES_ALTER';
    end if;
    v_age := v_age_raw::smallint;
    if v_age not between 1 and 120 then
      raise exception using errcode = '23514', message = 'UNGUELTIGES_ALTER';
    end if;
  end if;

  insert into public.profiles (id, role, first_name, last_name, username, age)
  values (
    new.id,
    case when v_meta ->> 'account_type' = 'standort' then 'standort'::public.app_role else 'nutzer'::public.app_role end,
    left(v_first, 50),
    left(v_last, 50),
    v_username,
    v_age
  )
  on conflict (id) do nothing;

  if jsonb_typeof(v_meta -> 'interests') = 'array' then
    for v_interest in
      select jsonb_array_elements_text(v_meta -> 'interests')
    loop
      if exists (
        select 1
        from unnest(enum_range(null::public.offer_category)) as category(value)
        where category.value::text = v_interest
      ) then
        insert into public.favorite_categories (user_id, category)
        values (new.id, v_interest::public.offer_category)
        on conflict (user_id, category) do nothing;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

-- Kontoantwort um die Daten der neuen Registrierung ergänzen.
create or replace function public.get_my_account()
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
  v_interests jsonb;
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

  select coalesce(jsonb_agg(fc.category::text order by fc.category), '[]'::jsonb)
    into v_interests
  from public.favorite_categories fc
  where fc.user_id = v_uid;

  return jsonb_build_object(
    'user_id', v_profile.id,
    'role', v_profile.role,
    'first_name', v_profile.first_name,
    'last_name', v_profile.last_name,
    'username', v_profile.username,
    'age', v_profile.age,
    'interests', v_interests,
    'profile_complete', v_profile.first_name is not null and v_profile.last_name is not null,
    'no_show_count', v_profile.no_show_count,
    'blocked_until', v_profile.blocked_until,
    'is_blocked', coalesce(v_profile.blocked_until > now(), false),
    'location', v_location
  );
end;
$$;

comment on function public.get_my_account is
  'Konto-Übersicht mit Rolle, Name, Nutzername, Alter, Interessen, profile_complete, Sperre und optionalem Standort.';
