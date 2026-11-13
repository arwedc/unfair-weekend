-- Zahlungen (Variante B): Einstellungen, Flag-Sperren, Stripe-Konto, RLS und Rechte
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('loc2', tests.create_location('approved'));
select tests.set_id('loc2_user', tests.location_user(tests.id('loc2')));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));
select tests.set_id('admin', tests.create_admin());
select tests.set_id('offer', tests.create_offer(tests.id('loc')));
select tests.set_id('offer2', tests.create_offer(tests.id('loc2')));

-- ----------------------------------------------------------------------------
-- Standardwerte, Cron, Realtime
-- ----------------------------------------------------------------------------
select is((select payments_enabled from public.payment_settings), false, 'Flag steht standardmäßig auf aus');
select is((select commission_bps from public.payment_settings), 1500, 'Provision 15 % (1500 Basispunkte)');
select is((select reservation_minutes from public.payment_settings), 10, 'Reservierung 10 Minuten');
select is((select payout_delay_hours from public.payment_settings), 24, 'Auszahlung 24 Std. nach Ende');
select ok(
  exists (select 1 from cron.job where jobname = 'unfair-pay-maintenance' and schedule = '* * * * *'),
  'Cron-Job unfair-pay-maintenance jede Minute'
);
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'paid_bookings'),
  'paid_bookings ist in der Realtime-Publikation'
);
select is(private.commission_cents(2400, 1500), 360, 'Provision 15 % von 24,00 € = 3,60 €');
select is(private.commission_cents(999, 1500), 150, 'Provision kaufmännisch gerundet (149,85 → 150)');
select is(private.commission_cents(1001, 1250), 125, 'Provision 12,5 % von 10,01 € = 1,25 € (125,125 → 125)');

-- ----------------------------------------------------------------------------
-- Flag aus: Variante A unverändert
-- ----------------------------------------------------------------------------
select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'Flag aus: claim_voucher wie bisher');
select throws_ok(
  format('select public.start_paid_booking(%L, 1)', tests.id('offer2')),
  'P0001', 'ZAHLUNGEN_AUS', 'Flag aus: keine bezahlte Buchung'
);
select tests.clear_authentication();
select lives_ok(
  format('select tests.create_offer(%L)', tests.id('loc2')),
  'Flag aus: Angebot ohne Stripe-Konto veröffentlichen geht'
);

-- ----------------------------------------------------------------------------
-- Lesen: anon und Nutzer sehen das Flag, ändern kann nur der Admin per RPC
-- ----------------------------------------------------------------------------
select tests.authenticate_as_anon();
select is((select payments_enabled from public.get_payment_settings()), false, 'anon liest das Flag');
select throws_ok('select * from public.paid_bookings', '42501', null, 'anon: paid_bookings gesperrt');
select throws_ok('select * from public.stripe_accounts', '42501', null, 'anon: stripe_accounts gesperrt');
select throws_ok('select public.start_paid_booking(gen_random_uuid(), 1)', '42501', null, 'anon: start_paid_booking gesperrt');

select tests.authenticate_as(tests.id('mia'));
select is((select commission_bps from public.get_payment_settings()), 1500, 'Nutzer liest die Provision');
select throws_ok('update public.payment_settings set payments_enabled = true', '42501', null, 'direktes Ändern verboten');
select throws_ok('select public.update_payment_settings(true, 1500)', 'P0001', 'KEIN_ZUGRIFF', 'nur Admins schalten das Flag');

-- Funktionen der Edge Functions sind für Clients gesperrt
select throws_ok('select public.confirm_paid_booking(gen_random_uuid(), ''pi_1'', ''ch_1'', 100, ''eur'')', '42501', null, 'confirm_paid_booking nur service_role');
select throws_ok('select public.attach_payment_intent(gen_random_uuid(), ''pi_1'')', '42501', null, 'attach_payment_intent nur service_role');
select throws_ok('select public.claim_payment_jobs(10, null)', '42501', null, 'claim_payment_jobs nur service_role');
select throws_ok('select public.record_webhook_event(''evt_1'', ''x'', false, now())', '42501', null, 'record_webhook_event nur service_role');
select throws_ok('select public.sync_stripe_account(''acct_1'', true, true, true, true, ''{}'', null)', '42501', null, 'sync_stripe_account nur service_role');

select tests.authenticate_as(tests.id('admin'));
select throws_ok('select public.update_payment_settings(true, 5001)', 'P0001', 'UNGUELTIGE_EINGABE', 'Provision höchstens 50 %');
select throws_ok('select public.update_payment_settings(null, 1500)', 'P0001', 'UNGUELTIGE_EINGABE', 'Flag muss gesetzt sein');
select is(
  (select row(payments_enabled, commission_bps)::text from public.update_payment_settings(false, 1200)),
  '(f,1200)', 'Admin setzt die Provision'
);
select is((select updated_by from public.payment_settings), tests.id('admin'), 'updated_by = Admin');
select lives_ok('select public.get_admin_payment_metrics()', 'Admin liest Kennzahlen');
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok('select public.get_admin_payment_metrics()', 'P0001', 'KEIN_ZUGRIFF', 'Kennzahlen nur für Admins');

-- ----------------------------------------------------------------------------
-- Flag an: Sperren in der Datenbank
-- ----------------------------------------------------------------------------
select tests.clear_authentication();
update public.payment_settings set payments_enabled = true, commission_bps = 1500;

-- Stripe-Konto: loc bereit, loc2 nicht (Onboarding nicht fertig)
insert into public.stripe_accounts (location_id, stripe_account_id, details_submitted, payouts_enabled, transfers_active)
values (tests.id('loc'), 'acct_testbereit', true, true, true);
insert into public.stripe_accounts (location_id, stripe_account_id, details_submitted)
values (tests.id('loc2'), 'acct_testnichtbereit', true);
select is((select is_ready from public.stripe_accounts where location_id = tests.id('loc')), true, 'is_ready = Transfers + Auszahlungen');
select is((select is_ready from public.stripe_accounts where location_id = tests.id('loc2')), false, 'nicht bereit ohne Transfers und Auszahlungen');

-- claim_voucher ist blockiert (Trigger), ohne dass sich die Funktion ändert
select tests.authenticate_as(tests.id('jonas'));
select throws_ok(
  format('select public.claim_voucher(%L, 1)', tests.id('offer')),
  'P0001', 'ZAHLUNG_ERFORDERLICH', 'Flag an: claim_voucher abgelehnt'
);
select tests.clear_authentication();
select is((select seats_taken from public.offers where id = tests.id('offer')), 1, 'abgelehnter Claim belegt keinen Platz');
select is(
  (select count(*)::int from public.vouchers where offer_id = tests.id('offer') and status = 'aktiv'),
  1, 'bestehender Gratis-Code bleibt gültig'
);

-- Veröffentlichen nur mit bereitem Stripe-Konto
select throws_ok(
  format('select tests.create_offer(%L)', tests.id('loc2')),
  'P0001', 'AUSZAHLUNGEN_EINRICHTEN', 'Flag an: ohne bereites Konto kein neues Angebot'
);
select lives_ok(format('select tests.create_offer(%L)', tests.id('loc')), 'Flag an: mit bereitem Konto geht es');

select tests.authenticate_as(tests.id('mia'));
select throws_ok(
  format('select public.start_paid_booking(%L, 1)', tests.id('offer2')),
  'P0001', 'ANBIETER_NICHT_BEREIT', 'Standort ohne verifiziertes Konto: nicht buchbar'
);

-- Kennzahl für die Warnung vor dem Einschalten
select tests.authenticate_as(tests.id('admin'));
select ok(
  (public.get_admin_payment_metrics() -> 'current' ->> 'offers_without_payout_account')::int >= 2,
  'Warnung: aktive Angebote ohne bereites Konto werden gezählt'
);

-- ----------------------------------------------------------------------------
-- stripe_accounts: Standort sieht nur sein Konto, Admin alle; Abgleich per service_role
-- ----------------------------------------------------------------------------
select tests.authenticate_as(tests.id('loc_user'));
select is((select count(*)::int from public.stripe_accounts), 1, 'Standort sieht nur sein Konto');
select tests.authenticate_as(tests.id('mia'));
select is((select count(*)::int from public.stripe_accounts), 0, 'Nutzer sehen keine Konten');
select tests.authenticate_as(tests.id('admin'));
select ok((select count(*)::int from public.stripe_accounts) >= 2, 'Admin sieht alle Konten');

select tests.clear_authentication();
select is(
  (select is_ready from public.sync_stripe_account('acct_testnichtbereit', true, false, true, true, '{}', null)),
  true, 'sync_stripe_account schaltet das Konto frei'
);
select is(
  (select stripe_account_id from public.register_stripe_account(tests.id('loc'), 'acct_anderes')),
  'acct_testbereit', 'register_stripe_account ist idempotent (bestehendes Konto bleibt)'
);
select ok(
  (select s is null from public.sync_stripe_account('acct_fremd', true, true, true, true, '{}', null) s),
  'unbekanntes Konto wird ignoriert'
);

-- ----------------------------------------------------------------------------
-- Webhook-Events: einmal verarbeiten
-- ----------------------------------------------------------------------------
select is(public.record_webhook_event('evt_test1', 'payment_intent.succeeded', false, now()), true, 'neues Event → verarbeiten');
select is(public.record_webhook_event('evt_test1', 'payment_intent.succeeded', false, now()), true, 'noch nicht fertig → erneut verarbeiten');
select lives_ok('select public.finish_webhook_event(''evt_test1'')', 'Event als verarbeitet markieren');
select is(public.record_webhook_event('evt_test1', 'payment_intent.succeeded', false, now()), false, 'doppeltes Event → nicht erneut');
select is((select attempts from public.stripe_webhook_events where event_id = 'evt_test1'), 3, 'Zustellversuche gezählt');

select * from finish();
