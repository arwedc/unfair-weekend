-- ============================================================================
-- Bewertungen des eigenen Standorts: Sortierung und Zeitraum
--
-- list_my_reviews bekommt zwei optionale Parameter am Ende:
--   p_sort  'neueste' (Standard), 'aelteste', 'beste', 'schlechteste'
--   p_since nur Bewertungen ab diesem Zeitpunkt (null = alle)
--
-- Bisherige Aufrufe (p_rating, p_limit, p_offset) funktionieren unverändert.
-- Die alte Signatur wird entfernt, damit PostgREST keine zwei Kandidaten hat.
-- Neue Sortierungen: Wert in v_sorts aufnehmen und im order by ergänzen.
-- ============================================================================

drop function public.list_my_reviews(integer, integer, integer);

create function public.list_my_reviews(
  p_rating integer default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_sort text default 'neueste',
  p_since timestamptz default null
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
  v_sorts constant text[] := array['neueste', 'aelteste', 'beste', 'schlechteste'];
  v_sort text := coalesce(p_sort, 'neueste');
begin
  if p_rating is not null and p_rating not between 1 and 5 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Filter: 1 bis 5 Sterne.');
  end if;
  if not v_sort = any (v_sorts) then
    perform private.raise_error(
      'UNGUELTIGE_EINGABE',
      'Sortierung: ' || array_to_string(v_sorts, ', ') || '.'
    );
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
    and (p_since is null or r.created_at >= p_since)
  order by
    case when v_sort = 'beste' then r.rating end desc nulls last,
    case when v_sort = 'schlechteste' then r.rating end asc nulls last,
    case when v_sort = 'aelteste' then r.created_at end asc nulls last,
    -- Standard und Gleichstand: neueste zuerst, id für eine stabile Reihenfolge
    r.created_at desc,
    r.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.list_my_reviews is
  'Standort: Bewertungen des eigenen Standorts inkl. ausgeblendeter (is_hidden). Optional nach Sternen (p_rating) und Zeitraum (p_since) gefiltert, sortiert nach p_sort (neueste, aelteste, beste, schlechteste; Gleichstand: neueste zuerst). Max. 50 pro Seite.';

revoke all on function public.list_my_reviews(integer, integer, integer, text, timestamptz) from public;
grant execute on function public.list_my_reviews(integer, integer, integer, text, timestamptz) to authenticated;
