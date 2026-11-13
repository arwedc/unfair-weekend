-- ============================================================================
-- Zahlungen (Variante B), Teil 3: Stripe-Worker per pg_cron, Event-IDs (v2)
--
-- Rein additiv bzw. nur an eigenen Zahlungs-Tabellen. Variante A unverändert.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Event-IDs der Thin Events (Accounts v2) können weitere Unterstriche enthalten
-- (z. B. evt_test_…). Prüfregel der eigenen Tabelle entsprechend lockern.
-- ----------------------------------------------------------------------------
alter table public.stripe_webhook_events
  drop constraint stripe_webhook_events_event_id_check;
alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_event_id_check check (event_id ~ '^evt_[A-Za-z0-9_]+$');

-- ----------------------------------------------------------------------------
-- invoke_payment_worker: ruft die Edge Function stripe-worker auf, wenn Jobs
-- fällig sind. Gleiches Muster und dieselben Vault-Secrets wie der Push-Versand:
--   project_url     https://<ref>.supabase.co
--   push_worker_key Secret Key (sb_secret_…), geht als apikey-Header mit
-- Fehlen sie, passiert nichts (Warnung im Postgres-Log).
-- ----------------------------------------------------------------------------
create function private.invoke_payment_worker()
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
    select 1 from public.payment_jobs j
    where j.status in ('offen', 'laeuft') and j.next_attempt_at <= now()
  ) then
    return null;
  end if;

  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'project_url';
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'push_worker_key';

  if v_url is null or v_key is null then
    raise warning 'stripe-worker: Vault-Secrets project_url und push_worker_key fehlen';
    return null;
  end if;

  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/stripe-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

comment on function private.invoke_payment_worker() is
  'pg_cron: ruft die Edge Function stripe-worker auf, wenn fällige Zahlungs-Jobs warten (Erstattungen, Auszahlungen, PaymentIntents abbrechen).';

revoke all on function private.invoke_payment_worker() from public, anon, authenticated;

select cron.schedule('unfair-pay-worker', '* * * * *', 'select private.invoke_payment_worker()');
