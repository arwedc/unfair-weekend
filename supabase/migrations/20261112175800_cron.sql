-- ============================================================================
-- Zeitgesteuerte Aufgaben (pg_cron, alle 5 Minuten)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Codes ablaufen lassen
-- Zeitraum: nach dem Ende. Einzeltermin: 48 Std. nach Ende (bis dahin kann
-- der Standort noch No-Shows markieren). Kein Strafeffekt, Plätze bleiben belegt.
-- ----------------------------------------------------------------------------
create function private.expire_vouchers()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.vouchers v
    set status = 'abgelaufen', expired_at = now()
    from public.offers o
    where o.id = v.offer_id
      and v.status = 'aktiv'
      and (
        (o.type = 'zeitraum' and o.ends_at <= now())
        or (o.type = 'einzeltermin' and o.ends_at + interval '48 hours' <= now())
      )
    returning v.id
  )
  select count(*)::integer from expired;
$$;

-- ----------------------------------------------------------------------------
-- Erinnerungen in die Outbox schreiben (nur Einzeltermine)
-- reminder_hours_before vor Start, einmal pro Code. Codes, die erst innerhalb
-- dieses Fensters geholt wurden, bekommen keine Erinnerung.
-- ----------------------------------------------------------------------------
create function private.enqueue_reminders()
returns integer
language sql
security definer
set search_path = ''
as $$
  with settings as (
    select make_interval(hours => s.reminder_hours_before) as window_size
    from public.settings s
    where s.id and s.reminder_hours_before > 0
  ),
  inserted as (
    insert into public.notification_outbox (type, recipient_user_id, offer_id, voucher_id, payload)
    select
      'erinnerung', v.user_id, o.id, v.id,
      jsonb_build_object(
        'offer_title', o.title,
        'starts_at', o.starts_at,
        'ends_at', o.ends_at,
        'address', o.address,
        'location_name', l.name,
        'short_code', v.short_code,
        'seats', v.seats
      )
    from public.vouchers v
    join public.offers o on o.id = v.offer_id
    join public.locations l on l.id = o.location_id
    cross join settings s
    where v.status = 'aktiv'
      and v.user_id is not null
      and o.type = 'einzeltermin'
      and o.status = 'aktiv'
      and o.starts_at > now()
      and o.starts_at <= now() + s.window_size
      and v.claimed_at < o.starts_at - s.window_size
    on conflict (type, voucher_id) do nothing
    returning id
  )
  select count(*)::integer from inserted;
$$;

-- Jobs (gleicher Name = vorhandenen Job aktualisieren)
select cron.schedule('unfair-expire-vouchers', '*/5 * * * *', 'select private.expire_vouchers()');
select cron.schedule('unfair-enqueue-reminders', '*/5 * * * *', 'select private.enqueue_reminders()');
