-- ============================================================================
-- Push, Teil 2: Outbox-Einträge für neue Angebote, Worker-RPCs und Cron
--
-- Ablauf:
--   1. Trigger auf public.offers legt für Nutzer mit passendem Favorit
--      (Standort oder Kategorie) einen Outbox-Eintrag 'neues_angebot' an.
--      Erinnerungen (pg_cron) und Absagen (cancel_offer) gibt es schon.
--   2. pg_cron ruft jede Minute private.invoke_push_worker() auf. Die Funktion
--      schickt nur dann einen HTTP-Aufruf an die Edge Function send-push, wenn
--      etwas zu tun ist. Projekt-URL und Secret Key liegen im Vault.
--   3. send-push holt Einträge mit claim_push_batch, verschickt sie über die
--      Expo-Push-API und meldet das Ergebnis mit finish_push_batch zurück.
--
-- Bestehende Tabellen, RPCs und Jobs bleiben unverändert.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Höchstens ein Push „neues Angebot“ pro Nutzer und Angebot.
-- Nur Einträge dieses Typs haben keinen Code (voucher_id is null).
-- ----------------------------------------------------------------------------
create unique index notification_outbox_offer_recipient_idx
  on public.notification_outbox (recipient_user_id, offer_id)
  where voucher_id is null;

-- ----------------------------------------------------------------------------
-- Trigger: neues Angebot → Outbox für Fans
-- ----------------------------------------------------------------------------
create function private.enqueue_new_offer_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_name text;
  v_company_name text;
begin
  if new.status <> 'aktiv' then
    return null;
  end if;

  select l.name, c.name into v_location_name, v_company_name
  from public.locations l
  join public.companies c on c.id = l.company_id
  where l.id = new.location_id and l.status = 'approved';

  -- Nur freigeschaltete Standorte lösen Pushes aus
  if not found then
    return null;
  end if;

  insert into public.notification_outbox (type, recipient_user_id, offer_id, payload)
  select
    'neues_angebot', fans.user_id, new.id,
    jsonb_build_object(
      'offer_title', new.title,
      'offer_type', new.type,
      'category', new.category,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at,
      -- gleiche Rechnung wie list_offers (abgerundet)
      'discount_percent', ((new.original_price_cents - new.deal_price_cents) * 100 / new.original_price_cents)::integer,
      'location_name', v_location_name,
      'company_name', v_company_name,
      -- 'standort' hat Vorrang, wenn beides passt
      'reason', case when fans.via_location then 'standort' else 'kategorie' end
    )
  from (
    select f.user_id, bool_or(f.via_location) as via_location
    from (
      select fl.user_id, true as via_location
      from public.favorite_locations fl
      where fl.location_id = new.location_id
      union all
      select fc.user_id, false
      from public.favorite_categories fc
      where fc.category = new.category
    ) f
    group by f.user_id
  ) fans
  -- Ohne registriertes Gerät gibt es nichts zu verschicken
  where exists (select 1 from public.push_tokens t where t.user_id = fans.user_id)
  on conflict (recipient_user_id, offer_id) where voucher_id is null do nothing;

  return null;
end;
$$;

comment on function private.enqueue_new_offer_notifications() is
  'Trigger: legt für Nutzer mit Lieblingsort oder -kategorie einen Push „neues Angebot“ an (höchstens einen pro Nutzer und Angebot).';

create trigger offers_enqueue_new_offer_notifications
  after insert on public.offers
  for each row
  execute function private.enqueue_new_offer_notifications();

-- ----------------------------------------------------------------------------
-- Worker-RPC 1: fällige Einträge abholen (nur service_role)
--
-- Sortiert vorher aus, was nicht mehr sinnvoll ist:
--   - fünfmal abgeholt, nie zurückgemeldet       → failed, ABGEBROCHEN
--   - Empfänger ohne registriertes Gerät        → failed, KEIN_GERAET
--   - Erinnerung, Termin hat schon begonnen      → failed, ZU_SPAET
--   - neues Angebot, älter als 24 Stunden        → failed, ZU_SPAET
-- Abgeholte Einträge stehen auf 'processing' und werden nach 10 Minuten wieder
-- fällig, falls der Worker abstürzt, bevor er finish_push_batch aufruft.
-- ----------------------------------------------------------------------------
create function public.claim_push_batch(p_limit integer default 100)
returns table (
  outbox_id bigint,
  notification_type public.notification_type,
  recipient_id uuid,
  offer_id uuid,
  voucher_id uuid,
  payload jsonb,
  attempts integer,
  tokens text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox o
  set status = 'failed', last_error = 'ABGEBROCHEN'
  where o.status = 'processing'
    and o.next_attempt_at <= now()
    and o.attempts >= 5;

  update public.notification_outbox o
  set status = 'failed', last_error = 'KEIN_GERAET'
  where o.status in ('pending', 'processing')
    and o.next_attempt_at <= now()
    and not exists (select 1 from public.push_tokens t where t.user_id = o.recipient_user_id);

  update public.notification_outbox o
  set status = 'failed', last_error = 'ZU_SPAET'
  where o.status in ('pending', 'processing')
    and o.next_attempt_at <= now()
    and (
      (o.type = 'erinnerung' and (o.payload ->> 'starts_at')::timestamptz <= now())
      or (o.voucher_id is null and o.created_at <= now() - interval '24 hours')
    );

  return query
  with picked as (
    select o.id
    from public.notification_outbox o
    where o.status in ('pending', 'processing') and o.next_attempt_at <= now()
    order by o.next_attempt_at, o.id
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  ),
  claimed as (
    update public.notification_outbox o
    set status = 'processing',
        attempts = o.attempts + 1,
        next_attempt_at = now() + interval '10 minutes'
    from picked
    where o.id = picked.id
    returning o.id, o.type, o.recipient_user_id, o.offer_id, o.voucher_id, o.payload, o.attempts
  )
  select
    c.id, c.type, c.recipient_user_id, c.offer_id, c.voucher_id, c.payload, c.attempts,
    coalesce(
      (select array_agg(t.token order by t.id) from public.push_tokens t where t.user_id = c.recipient_user_id),
      '{}'::text[]
    )
  from claimed c
  order by c.id;
end;
$$;

comment on function public.claim_push_batch(integer) is
  'Worker (send-push): holt bis zu p_limit fällige Outbox-Einträge mit den Push-Tokens des Empfängers. Nur service_role.';

-- ----------------------------------------------------------------------------
-- Worker-RPC 2: Ergebnis zurückmelden (nur service_role)
--
-- p_sent_ids:       verschickt
-- p_failed:         [{"id": 1, "error": "MessageRateExceeded", "retry": true}, …]
--                   retry=true → nach 1, 4, 9, 16 Minuten erneut; ab Versuch 5 endgültig failed
-- p_invalid_tokens: Tokens, die Expo als ungültig meldet (DeviceNotRegistered) → gelöscht
-- ----------------------------------------------------------------------------
create function public.finish_push_batch(
  p_sent_ids bigint[] default '{}',
  p_failed jsonb default '[]'::jsonb,
  p_invalid_tokens text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sent integer;
  v_retry integer;
  v_failed integer;
  v_tokens integer;
begin
  if jsonb_typeof(coalesce(p_failed, '[]'::jsonb)) <> 'array' then
    raise exception 'UNGUELTIGE_EINGABE';
  end if;

  delete from public.push_tokens t where t.token = any(coalesce(p_invalid_tokens, '{}'));
  get diagnostics v_tokens = row_count;

  update public.notification_outbox o
  set status = 'sent', sent_at = now(), last_error = null
  where o.id = any(coalesce(p_sent_ids, '{}')) and o.status = 'processing';
  get diagnostics v_sent = row_count;

  with failures as (
    select distinct on ((e ->> 'id')::bigint)
      (e ->> 'id')::bigint as id,
      left(coalesce(nullif(e ->> 'error', ''), 'UNBEKANNT'), 500) as error,
      coalesce((e ->> 'retry')::boolean, true) as retry
    from jsonb_array_elements(coalesce(p_failed, '[]'::jsonb)) e
    where e ->> 'id' is not null
  ),
  updated as (
    update public.notification_outbox o
    set status = case when f.retry and o.attempts < 5 then 'pending' else 'failed' end::public.notification_status,
        last_error = f.error,
        next_attempt_at = now() + make_interval(mins => o.attempts * o.attempts)
    from failures f
    where o.id = f.id and o.status = 'processing'
    returning o.status
  )
  select
    count(*) filter (where status = 'pending')::integer,
    count(*) filter (where status = 'failed')::integer
  into v_retry, v_failed
  from updated;

  return jsonb_build_object(
    'sent', v_sent,
    'retry', v_retry,
    'failed', v_failed,
    'tokens_removed', v_tokens
  );
end;
$$;

comment on function public.finish_push_batch(bigint[], jsonb, text[]) is
  'Worker (send-push): markiert Einträge als verschickt oder fehlgeschlagen (mit Backoff) und löscht ungültige Push-Tokens. Nur service_role.';

revoke all on function public.claim_push_batch(integer) from public, anon, authenticated;
revoke all on function public.finish_push_batch(bigint[], jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;
grant execute on function public.finish_push_batch(bigint[], jsonb, text[]) to service_role;

-- ----------------------------------------------------------------------------
-- Cron: jede Minute prüfen und bei Bedarf send-push aufrufen
--
-- Erwartet zwei Vault-Secrets (einmalig pro Projekt anlegen, nie im Repo):
--   project_url     https://<ref>.supabase.co
--   push_worker_key Secret Key (sb_secret_…), geht als apikey-Header mit
-- Fehlen sie, passiert nichts (Warnung im Postgres-Log).
-- ----------------------------------------------------------------------------
create function private.invoke_push_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  if not exists (
    select 1 from public.notification_outbox o
    where o.status in ('pending', 'processing') and o.next_attempt_at <= now()
  ) then
    return null;
  end if;

  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'project_url';
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'push_worker_key';

  if v_url is null or v_key is null then
    raise warning 'send-push: Vault-Secrets project_url und push_worker_key fehlen';
    return null;
  end if;

  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
end;
$$;

comment on function private.invoke_push_worker() is
  'pg_cron: ruft die Edge Function send-push auf, wenn fällige Outbox-Einträge warten.';

revoke all on function private.invoke_push_worker() from public, anon, authenticated;

select cron.schedule('unfair-send-push', '* * * * *', 'select private.invoke_push_worker()');
