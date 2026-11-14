-- ============================================================================
-- Profilbild für Nutzer
--
-- profiles.avatar_path: Pfad im privaten Bucket avatars (ohne Bucket-Namen),
-- immer im eigenen Ordner: avatars/<user_id>/<datei>.
-- Der Bucket ist nicht öffentlich: Nur der Nutzer selbst (und Admins) dürfen
-- lesen, die App zeigt das Bild über eine signierte URL.
-- Gesetzt und entfernt wird der Pfad über update_my_avatar(). get_my_account()
-- liefert ihn zusätzlich als avatar_path (die übrigen Felder bleiben gleich).
-- Alte Dateien löscht die App selbst über die Storage-API (direktes Löschen in
-- storage.objects ist in Supabase gesperrt).
-- ============================================================================

alter table public.profiles add column avatar_path text;

alter table public.profiles
  add constraint profiles_avatar_path_check
  check (avatar_path is null or (char_length(avatar_path) <= 200 and avatar_path like id::text || '/_%'));

comment on column public.profiles.avatar_path is
  'Profilbild: Pfad im Bucket avatars (<user_id>/<datei>), null = kein Bild.';

-- ----------------------------------------------------------------------------
-- Bucket avatars: privat, max. 2 MB, JPEG/PNG/WebP
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: eigenen Ordner lesen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );

create policy "avatars: in eigenen Ordner hochladen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: im eigenen Ordner ersetzen" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: im eigenen Ordner löschen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );

-- ----------------------------------------------------------------------------
-- update_my_avatar: Profilbild setzen (Pfad einer hochgeladenen Datei im
-- eigenen Ordner) oder mit null entfernen. Gibt den neuen Pfad zurück.
-- ----------------------------------------------------------------------------
create function public.update_my_avatar(p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_path text := nullif(btrim(coalesce(p_path, '')), '');
begin
  if v_path is not null and (
    char_length(v_path) > 200
    or v_path not like v_uid::text || '/_%'
    or position('/' in substr(v_path, char_length(v_uid::text) + 2)) > 0
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'avatars' and o.name = v_path
    )
  ) then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Das Profilbild ist ungültig. Bitte lade es erneut hoch.');
  end if;

  update public.profiles
  set avatar_path = v_path
  where id = v_uid;

  if not found then
    perform private.raise_error('KEIN_PROFIL', 'Zu diesem Konto gibt es kein Profil.');
  end if;

  return v_path;
end;
$$;

comment on function public.update_my_avatar(text) is
  'Setzt das eigene Profilbild (Pfad im Bucket avatars, eigener Ordner) oder entfernt es mit null.';

revoke all on function public.update_my_avatar(text) from public, anon;
grant execute on function public.update_my_avatar(text) to authenticated;

-- ----------------------------------------------------------------------------
-- get_my_account: zusätzlich avatar_path. Sonst unverändert gegenüber
-- 20261113161851_registrierung_ohne_nutzername.sql.
-- ----------------------------------------------------------------------------
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
    'age', v_profile.age,
    'interests', v_interests,
    'profile_complete', v_profile.first_name is not null and v_profile.last_name is not null,
    'no_show_count', v_profile.no_show_count,
    'blocked_until', v_profile.blocked_until,
    'is_blocked', coalesce(v_profile.blocked_until > now(), false),
    'location', v_location,
    'avatar_path', v_profile.avatar_path
  );
end;
$$;

comment on function public.get_my_account is
  'Konto-Übersicht mit Rolle, Name, Alter, Interessen, profile_complete, Sperre, Profilbild und optionalem Standort.';
