-- ============================================================================
-- Bewertungen für den eigenen Standort (Website)
--
-- Der Standort darf reviews per RLS schon lesen, aber nicht die Profile der
-- Verfasser. Diese beiden RPCs liefern die Liste mit Anzeigenamen („Mia K.“)
-- und Angebot sowie eine Übersicht (Durchschnitt, Verteilung).
--
-- Ausgeblendete Bewertungen (Admin) erscheinen in der Liste mit is_hidden = true,
-- zählen aber wie öffentlich nicht im Durchschnitt. Der Grund des Admins bleibt intern.
-- Bestehende Tabellen und RPCs bleiben unverändert.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- list_my_reviews: Bewertungen des eigenen Standorts, neueste zuerst
-- ----------------------------------------------------------------------------
create function public.list_my_reviews(
  p_rating integer default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  rating smallint,
  comment text,
  created_at timestamptz,
  author_name text,
  offer_id uuid,
  offer_title text,
  is_hidden boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(false);
begin
  if p_rating is not null and p_rating not between 1 and 5 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Filter: 1 bis 5 Sterne.');
  end if;

  return query
  select
    r.id, r.rating, r.comment, r.created_at,
    private.review_author_name(p.first_name, p.last_name),
    o.id, o.title,
    r.hidden_at is not null
  from public.reviews r
  join public.profiles p on p.id = r.user_id
  join public.vouchers v on v.id = r.voucher_id
  join public.offers o on o.id = v.offer_id
  where r.location_id = v_location.id
    and (p_rating is null or r.rating = p_rating)
  order by r.created_at desc, r.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.list_my_reviews is
  'Standort: Bewertungen des eigenen Standorts inkl. ausgeblendeter (is_hidden), neueste zuerst, optional nach Sternen gefiltert (max. 50 pro Seite).';

-- ----------------------------------------------------------------------------
-- get_my_review_summary: Übersicht für den eigenen Standort (immer genau 1 Zeile)
-- Durchschnitt und Verteilung wie öffentlich (nur sichtbare Bewertungen).
-- ----------------------------------------------------------------------------
create function public.get_my_review_summary()
returns table (
  review_count integer,
  average_rating numeric,
  rating_1 integer,
  rating_2 integer,
  rating_3 integer,
  rating_4 integer,
  rating_5 integer,
  hidden_count integer,
  last_30_days integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_location public.locations := private.require_location(false);
begin
  return query
  select
    (count(*) filter (where r.hidden_at is null))::integer,
    round(avg(r.rating) filter (where r.hidden_at is null), 1),
    (count(*) filter (where r.hidden_at is null and r.rating = 1))::integer,
    (count(*) filter (where r.hidden_at is null and r.rating = 2))::integer,
    (count(*) filter (where r.hidden_at is null and r.rating = 3))::integer,
    (count(*) filter (where r.hidden_at is null and r.rating = 4))::integer,
    (count(*) filter (where r.hidden_at is null and r.rating = 5))::integer,
    (count(*) filter (where r.hidden_at is not null))::integer,
    (count(*) filter (where r.hidden_at is null and r.created_at > now() - interval '30 days'))::integer
  from public.reviews r
  where r.location_id = v_location.id;
end;
$$;

comment on function public.get_my_review_summary is
  'Standort: Anzahl, Durchschnitt (1 Nachkommastelle, null ohne Bewertung) und Verteilung 1–5 der sichtbaren Bewertungen, dazu ausgeblendete und die der letzten 30 Tage.';

-- ----------------------------------------------------------------------------
-- Rechte
-- ----------------------------------------------------------------------------
revoke all on function public.list_my_reviews(integer, integer, integer) from public;
revoke all on function public.get_my_review_summary() from public;

grant execute on function public.list_my_reviews(integer, integer, integer) to authenticated;
grant execute on function public.get_my_review_summary() to authenticated;
