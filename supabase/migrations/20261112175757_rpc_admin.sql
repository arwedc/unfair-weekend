-- ============================================================================
-- RPCs für Admins (Website)
-- Admin wird per SQL oder Seed gesetzt: update public.profiles set role = 'admin' …
-- Lesen dürfen Admins alle Tabellen direkt (RLS), Schreiben nur über diese RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- approve_location: Standort freischalten
-- Optional einem bestehenden Unternehmen zuordnen (weiterer Standort). Bleibt
-- das bisherige Unternehmen ohne Standorte zurück, wird es gelöscht.
-- ----------------------------------------------------------------------------
create function public.approve_location(
  p_location_id uuid,
  p_merge_into_company_id uuid default null
)
returns public.locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_location public.locations;
  v_old_company_id uuid;
begin
  select * into v_location from public.locations where id = p_location_id for update;
  if not found then
    perform private.raise_error('STANDORT_NICHT_GEFUNDEN', 'Diesen Standort gibt es nicht.');
  end if;
  if v_location.status = 'approved' then
    perform private.raise_error('STATUS_UNGUELTIG', 'Der Standort ist bereits freigeschaltet.');
  end if;

  v_old_company_id := v_location.company_id;
  if p_merge_into_company_id is not null and p_merge_into_company_id <> v_old_company_id then
    if not exists (select 1 from public.companies c where c.id = p_merge_into_company_id) then
      perform private.raise_error('UNTERNEHMEN_NICHT_GEFUNDEN', 'Dieses Unternehmen gibt es nicht.');
    end if;
  end if;

  update public.locations
  set status = 'approved', status_reason = null, status_changed_at = now(), status_changed_by = v_admin,
      company_id = coalesce(p_merge_into_company_id, company_id)
  where id = p_location_id
  returning * into v_location;

  if v_location.company_id <> v_old_company_id
    and not exists (select 1 from public.locations l where l.company_id = v_old_company_id) then
    delete from public.companies where id = v_old_company_id;
  end if;

  return v_location;
end;
$$;

comment on function public.approve_location is
  'Admin: Standort freischalten (pending/rejected → approved). Optional p_merge_into_company_id, um ihn einem bestehenden Unternehmen zuzuordnen.';

-- ----------------------------------------------------------------------------
-- reject_location: Standort ablehnen bzw. sperren
-- Aktive Angebote werden abgesagt (Codes storniert, Inhaber benachrichtigt).
-- ----------------------------------------------------------------------------
create function public.reject_location(p_location_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_location public.locations;
  v_offer_id uuid;
  v_offers integer := 0;
  v_vouchers integer := 0;
begin
  select * into v_location from public.locations where id = p_location_id for update;
  if not found then
    perform private.raise_error('STANDORT_NICHT_GEFUNDEN', 'Diesen Standort gibt es nicht.');
  end if;
  if v_location.status = 'rejected' then
    perform private.raise_error('STATUS_UNGUELTIG', 'Der Standort ist bereits abgelehnt.');
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Begründung: höchstens 500 Zeichen.');
  end if;

  update public.locations
  set status = 'rejected', status_reason = nullif(btrim(p_reason), ''), status_changed_at = now(),
      status_changed_by = v_admin
  where id = p_location_id;

  for v_offer_id in
    select o.id from public.offers o
    where o.location_id = p_location_id and o.status = 'aktiv'
    order by o.id
    for update
  loop
    update public.offers
    set status = 'abgesagt', status_reason = 'Standort gesperrt', status_changed_at = now(),
        status_changed_by = v_admin
    where id = v_offer_id;
    v_vouchers := v_vouchers + private.cancel_active_vouchers(v_offer_id, 'angebot_abgesagt', null);
    v_offers := v_offers + 1;
  end loop;

  return jsonb_build_object(
    'location_id', p_location_id,
    'status', 'rejected',
    'cancelled_offers', v_offers,
    'cancelled_vouchers', v_vouchers
  );
end;
$$;

comment on function public.reject_location is
  'Admin: Standort ablehnen (auch nach Freischaltung = Sperre). Sagt aktive Angebote ab und storniert deren Codes.';

-- ----------------------------------------------------------------------------
-- remove_offer: Angebot durch Admin entfernen (wirkt wie eine Absage)
-- ----------------------------------------------------------------------------
create function public.remove_offer(p_offer_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_offer public.offers;
  v_count integer;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    perform private.raise_error('ANGEBOT_NICHT_GEFUNDEN', 'Dieses Angebot gibt es nicht.');
  end if;
  if v_offer.status = 'entfernt' then
    perform private.raise_error('ANGEBOT_NICHT_AKTIV', 'Das Angebot ist bereits entfernt.');
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Begründung: höchstens 500 Zeichen.');
  end if;

  update public.offers
  set status = 'entfernt', status_reason = nullif(btrim(p_reason), ''), status_changed_at = now(),
      status_changed_by = v_admin
  where id = p_offer_id;

  v_count := private.cancel_active_vouchers(p_offer_id, 'angebot_entfernt', null);

  return jsonb_build_object('offer_id', p_offer_id, 'status', 'entfernt', 'cancelled_vouchers', v_count);
end;
$$;

-- ----------------------------------------------------------------------------
-- update_settings: globale Einstellungen ändern (alle Werte übergeben)
-- ----------------------------------------------------------------------------
create function public.update_settings(
  p_min_discount_percent integer,
  p_cancel_deadline_hours integer,
  p_no_show_limit integer,
  p_block_days integer,
  p_reminder_hours_before integer
)
returns public.settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_settings public.settings;
begin
  if p_min_discount_percent is null or p_min_discount_percent not between 0 and 100
    or p_cancel_deadline_hours is null or p_cancel_deadline_hours not between 0 and 168
    or p_no_show_limit is null or p_no_show_limit not between 1 and 20
    or p_block_days is null or p_block_days not between 1 and 365
    or p_reminder_hours_before is null or p_reminder_hours_before not between 0 and 72
  then
    perform private.raise_error(
      'UNGUELTIGE_EINGABE',
      'Erlaubt: Mindestrabatt 0–100 %, Storno-Frist 0–168 Std., No-Show-Limit 1–20, Sperre 1–365 Tage, Erinnerung 0–72 Std.'
    );
  end if;

  update public.settings
  set min_discount_percent = p_min_discount_percent,
      cancel_deadline_hours = p_cancel_deadline_hours,
      no_show_limit = p_no_show_limit,
      block_days = p_block_days,
      reminder_hours_before = p_reminder_hours_before,
      updated_by = v_admin
  where id
  returning * into v_settings;
  return v_settings;
end;
$$;

-- ----------------------------------------------------------------------------
-- get_admin_metrics: Kennzahlen pro Woche, Standort und Kategorie
-- Zeitraum in Berliner Kalendertagen (Standard: die letzten 12 Wochen).
-- Einlösequote = eingelöst / (geholt − storniert).
-- ----------------------------------------------------------------------------
create function public.get_admin_metrics(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_from date := coalesce(p_from, (now() at time zone 'Europe/Berlin')::date - 83);
  v_to date := coalesce(p_to, (now() at time zone 'Europe/Berlin')::date);
  v_result jsonb;
begin
  perform private.require_admin();
  if v_from > v_to or v_to - v_from > 731 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Zeitraum: Beginn vor Ende, höchstens 2 Jahre.');
  end if;

  with ev as (
    select e.*, date_trunc('week', e.created_at at time zone 'Europe/Berlin')::date as week_start
    from public.events e
    where e.created_at >= (v_from::timestamp at time zone 'Europe/Berlin')
      and e.created_at < ((v_to + 1)::timestamp at time zone 'Europe/Berlin')
  ),
  grouped as (
    select
      grouping(week_start) = 0 as by_week,
      grouping(location_id) = 0 as by_location,
      grouping(category) = 0 as by_category,
      week_start, location_id, category,
      count(*) filter (where type = 'angebot_angesehen') as views,
      count(*) filter (where type = 'code_geholt') as claims,
      coalesce(sum(seats) filter (where type = 'code_geholt'), 0) as claimed_seats,
      count(*) filter (where type = 'code_storniert') as cancellations,
      count(*) filter (where type = 'code_eingeloest') as redemptions,
      coalesce(sum(seats) filter (where type = 'code_eingeloest'), 0) as redeemed_seats,
      count(*) filter (where type = 'no_show') as no_shows
    from ev
    group by grouping sets ((), (week_start), (location_id), (category))
  ),
  rows as (
    select g.*,
      round(g.redemptions::numeric / nullif(g.claims - g.cancellations, 0), 3) as redemption_rate
    from grouped g
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'totals', coalesce(
      (select to_jsonb(r) - 'by_week' - 'by_location' - 'by_category' - 'week_start' - 'location_id' - 'category'
       from rows r where not r.by_week and not r.by_location and not r.by_category),
      '{}'::jsonb
    ),
    'by_week', coalesce(
      (select jsonb_agg(
         to_jsonb(r) - 'by_week' - 'by_location' - 'by_category' - 'location_id' - 'category'
         order by r.week_start)
       from rows r where r.by_week),
      '[]'::jsonb
    ),
    'by_location', coalesce(
      (select jsonb_agg(
         (to_jsonb(r) - 'by_week' - 'by_location' - 'by_category' - 'week_start' - 'category')
           || jsonb_build_object('location_name', l.name, 'company_name', c.name)
         order by l.name)
       from rows r
       join public.locations l on l.id = r.location_id
       join public.companies c on c.id = l.company_id
       where r.by_location),
      '[]'::jsonb
    ),
    'by_category', coalesce(
      (select jsonb_agg(
         to_jsonb(r) - 'by_week' - 'by_location' - 'by_category' - 'week_start' - 'location_id'
         order by r.category)
       from rows r where r.by_category),
      '[]'::jsonb
    ),
    'current', jsonb_build_object(
      'active_offers', (
        select count(*) from public.offers o join public.locations l on l.id = o.location_id
        where o.status = 'aktiv' and l.status = 'approved'
          and case when o.type = 'einzeltermin' then o.starts_at > now() else o.ends_at > now() end
      ),
      'pending_locations', (select count(*) from public.locations where status = 'pending'),
      'approved_locations', (select count(*) from public.locations where status = 'approved'),
      'users', (select count(*) from public.profiles where role = 'nutzer'),
      'blocked_users', (select count(*) from public.profiles where blocked_until > now()),
      'as_of', v_today
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_metrics is
  'Admin: Kennzahlen (views, claims, claimed_seats, cancellations, redemptions, redeemed_seats, no_shows, redemption_rate) gesamt, pro Woche (Mo., Berliner Zeit), pro Standort und pro Kategorie, dazu aktuelle Bestandszahlen.';

-- ----------------------------------------------------------------------------
-- Rechte
-- ----------------------------------------------------------------------------
revoke all on function public.approve_location(uuid, uuid) from public;
revoke all on function public.reject_location(uuid, text) from public;
revoke all on function public.remove_offer(uuid, text) from public;
revoke all on function public.update_settings(integer, integer, integer, integer, integer) from public;
revoke all on function public.get_admin_metrics(date, date) from public;

grant execute on function public.approve_location(uuid, uuid) to authenticated;
grant execute on function public.reject_location(uuid, text) to authenticated;
grant execute on function public.remove_offer(uuid, text) to authenticated;
grant execute on function public.update_settings(integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.get_admin_metrics(date, date) to authenticated;
