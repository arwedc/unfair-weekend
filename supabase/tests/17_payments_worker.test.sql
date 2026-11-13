-- Zahlungen (Variante B): Aufruf des Stripe-Workers per Cron, Event-IDs der Thin Events
select no_plan();

select ok(
  exists (select 1 from cron.job where jobname = 'unfair-pay-worker' and schedule = '* * * * *'),
  'Cron-Job unfair-pay-worker jede Minute'
);

-- Ohne fällige Jobs ruft der Cron nichts auf
delete from public.payment_jobs;
select is(private.invoke_payment_worker(), null, 'keine Jobs → kein Aufruf');

-- Thin Events (Accounts v2) haben IDs mit weiteren Unterstrichen
select is(
  public.record_webhook_event('evt_test_65RM8sQ5kLRXmq0kpp516QuQ1E', 'v2.core.account.updated', false, now()),
  true, 'Event-ID im v2-Format wird angenommen'
);
select throws_ok(
  'select public.record_webhook_event(''kein_event'', ''x'', false, now())',
  '23514', null, 'ungültige Event-ID wird abgelehnt'
);

-- Nicht für Clients
select tests.authenticate_as(tests.create_nutzer('Mia'));
select throws_ok('select private.invoke_payment_worker()', '42501', null, 'Nutzer können den Worker nicht aufrufen');

select * from finish();
