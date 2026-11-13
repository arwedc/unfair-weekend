-- ============================================================================
-- Bewertungen für Standorte
--
-- Regeln:
--   - Bewerten darf nur, wer an diesem Standort einen eingelösten Code hat.
--   - Pro Nutzer und Standort genau eine Bewertung (1–5 Sterne, optional Text).
--   - Öffentlich sichtbar: Vorname + Initial, Sterne, Text, Datum, Angebot.
--   - Der Admin kann Bewertungen ausblenden (und wieder einblenden).
--   - Kontolöschung löscht die Bewertungen mit (Kaskade über profiles).
-- Schreiben nur über RPCs. Bestehende Tabellen und RPCs bleiben unverändert.
-- ============================================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- der eingelöste Code, der zur Bewertung berechtigt hat
  voucher_id uuid not null unique references public.vouchers (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  hidden_at timestamptz,
  hidden_by uuid references auth.users (id) on delete set null,
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_one_per_user_and_location unique (user_id, location_id)
);
comment on table public.reviews is
  'Bewertungen von Standorten durch Nutzer mit eingelöstem Code. Schreiben nur über RPCs (create_review, set_review_hidden).';
comment on column public.reviews.hidden_at is 'Vom Admin ausgeblendet (null = sichtbar).';

-- Öffentliche Liste: sichtbare Bewertungen eines Standorts, neueste zuerst
create index reviews_location_visible_idx
  on public.reviews (location_id, created_at desc) where hidden_at is null;
-- RLS (Standort sieht seine) und FK
create index reviews_location_id_idx on public.reviews (location_id);
create index reviews_hidden_by_idx on public.reviews (hidden_by);
-- user_id ist über den Unique-Index (user_id, location_id) abgedeckt, voucher_id über unique.

create trigger set_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS und Rechte: Lesen der eigenen Zeilen; öffentliche Sicht nur über RPCs.
-- ----------------------------------------------------------------------------
alter table public.reviews enable row level security;

revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to authenticated;

-- Nutzer: eigene Bewertungen; Standort: Bewertungen seines Standorts (auch ausgeblendete); Admin alle
create policy "reviews: eigene, Standort seine, Admin alle" on public.reviews
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or location_id = (select private.my_location_id())
    or (select private.is_admin())
  );

-- ----------------------------------------------------------------------------
-- Anzeigename: „Mia K.“ (Vorname + Initial des Nachnamens), sonst „Gast“
-- ----------------------------------------------------------------------------
create function private.review_author_name(p_first_name text, p_last_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(
      coalesce(btrim(p_first_name), '')
      || case when nullif(btrim(p_last_name), '') is not null
           then ' ' || upper(left(btrim(p_last_name), 1)) || '.'
           else '' end
    ), ''),
    'Gast'
  );
$$;

-- ----------------------------------------------------------------------------
-- create_review: Standort zu einem eingelösten Code bewerten
-- ----------------------------------------------------------------------------
create function public.create_review(
  p_voucher_id uuid,
  p_rating integer,
  p_comment text default null
)
returns table (
  id uuid,
  location_id uuid,
  voucher_id uuid,
  rating smallint,
  comment text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
  v_voucher public.vouchers;
  v_location_id uuid;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_review public.reviews;
begin
  if p_rating is null or p_rating not between 1 and 5 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Bitte vergib 1 bis 5 Sterne.');
  end if;
  if v_comment is not null and char_length(v_comment) > 1000 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Der Text darf höchstens 1000 Zeichen haben.');
  end if;

  select * into v_voucher from public.vouchers v where v.id = p_voucher_id and v.user_id = v_uid;
  if not found then
    perform private.raise_error('CODE_NICHT_GEFUNDEN', 'Diesen Code gibt es nicht.');
  end if;
  if v_voucher.status <> 'eingeloest' then
    perform private.raise_error(
      'BEWERTUNG_NICHT_MOEGLICH',
      'Bewerten kannst du, sobald dein Code vor Ort eingelöst wurde.'
    );
  end if;

  select o.location_id into v_location_id from public.offers o where o.id = v_voucher.offer_id;

  if exists (
    select 1 from public.reviews r where r.user_id = v_uid and r.location_id = v_location_id
  ) then
    perform private.raise_error('BEREITS_BEWERTET', 'Diesen Ort hast du schon bewertet.');
  end if;

  insert into public.reviews (location_id, user_id, voucher_id, rating, comment)
  values (v_location_id, v_uid, v_voucher.id, p_rating, v_comment)
  on conflict on constraint reviews_one_per_user_and_location do nothing
  returning * into v_review;

  -- gleichzeitige zweite Anfrage: die erste hat gewonnen
  if v_review.id is null then
    perform private.raise_error('BEREITS_BEWERTET', 'Diesen Ort hast du schon bewertet.');
  end if;

  return query
  select v_review.id, v_review.location_id, v_review.voucher_id, v_review.rating,
         v_review.comment, v_review.created_at;
end;
$$;

comment on function public.create_review is
  'Bewertet den Standort zu einem eigenen, eingelösten Code (1–5 Sterne, Text optional, max. 1000 Zeichen). Pro Nutzer und Standort einmal.';

-- ----------------------------------------------------------------------------
-- list_location_reviews: sichtbare Bewertungen eines freigeschalteten Standorts
-- Auch ohne Login. Neueste zuerst, seitenweise.
-- ----------------------------------------------------------------------------
create function public.list_location_reviews(
  p_location_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  rating smallint,
  comment text,
  created_at timestamptz,
  author_name text,
  offer_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.rating, r.comment, r.created_at,
    private.review_author_name(p.first_name, p.last_name),
    o.title
  from public.reviews r
  join public.locations l on l.id = r.location_id
  join public.profiles p on p.id = r.user_id
  join public.vouchers v on v.id = r.voucher_id
  join public.offers o on o.id = v.offer_id
  where r.location_id = p_location_id
    and r.hidden_at is null
    and l.status = 'approved'
  order by r.created_at desc, r.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

comment on function public.list_location_reviews is
  'Sichtbare Bewertungen eines freigeschalteten Standorts, neueste zuerst (max. 50 pro Seite). Name als „Vorname I.“. Auch ohne Login.';

-- ----------------------------------------------------------------------------
-- get_location_ratings: Durchschnitt und Anzahl sichtbarer Bewertungen
-- Für Standortseite, Angebotsseite und Karten. Standorte ohne Bewertung fehlen.
-- ----------------------------------------------------------------------------
create function public.get_location_ratings(p_location_ids uuid[])
returns table (
  location_id uuid,
  review_count integer,
  average_rating numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.location_id, count(*)::integer, round(avg(r.rating), 1)
  from public.reviews r
  join public.locations l on l.id = r.location_id
  where r.hidden_at is null
    and l.status = 'approved'
    -- höchstens 100 IDs pro Aufruf
    and r.location_id = any ((coalesce(p_location_ids, '{}'::uuid[]))[1:100])
  group by r.location_id
  order by r.location_id;
$$;

comment on function public.get_location_ratings is
  'Anzahl und Durchschnitt (1 Nachkommastelle) sichtbarer Bewertungen je Standort (max. 100 IDs). Ohne Bewertung kein Eintrag. Auch ohne Login.';

-- ----------------------------------------------------------------------------
-- set_review_hidden: Admin blendet eine Bewertung aus oder wieder ein
-- ----------------------------------------------------------------------------
create function public.set_review_hidden(
  p_review_id uuid,
  p_hidden boolean,
  p_reason text default null
)
returns table (
  id uuid,
  hidden_at timestamptz,
  hidden_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin uuid := private.require_admin();
  v_review public.reviews;
begin
  if p_hidden is null then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Bitte angeben, ob die Bewertung sichtbar sein soll.');
  end if;

  update public.reviews r
  set hidden_at = case when p_hidden then coalesce(r.hidden_at, now()) end,
      hidden_by = case when p_hidden then v_admin end,
      hidden_reason = case when p_hidden then left(nullif(btrim(coalesce(p_reason, '')), ''), 500) end
  where r.id = p_review_id
  returning * into v_review;

  if not found then
    perform private.raise_error('BEWERTUNG_NICHT_GEFUNDEN', 'Diese Bewertung gibt es nicht.');
  end if;

  return query select v_review.id, v_review.hidden_at, v_review.hidden_reason;
end;
$$;

comment on function public.set_review_hidden is
  'Nur Admin: Bewertung ausblenden (p_hidden = true, Grund optional) oder wieder einblenden.';

-- ----------------------------------------------------------------------------
-- Rechte
-- ----------------------------------------------------------------------------
revoke all on function private.review_author_name(text, text) from public;
revoke all on function public.create_review(uuid, integer, text) from public;
revoke all on function public.list_location_reviews(uuid, integer, integer) from public;
revoke all on function public.get_location_ratings(uuid[]) from public;
revoke all on function public.set_review_hidden(uuid, boolean, text) from public;

grant execute on function public.create_review(uuid, integer, text) to authenticated;
grant execute on function public.list_location_reviews(uuid, integer, integer) to anon, authenticated;
grant execute on function public.get_location_ratings(uuid[]) to anon, authenticated;
grant execute on function public.set_review_hidden(uuid, boolean, text) to authenticated;
