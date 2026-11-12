-- mark_no_show: ab Start, nur Einzeltermin, nur eigener Standort, Sperre nach N
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('fremd_user', tests.location_user(tests.create_location('approved')));
select tests.set_id('mia', tests.create_nutzer('Mia'));

select tests.set_id('zukunft', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '1 minute', now() + interval '2 hours'));
select tests.set_id('laeuft', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '1 minute', now() + interval '2 hours'));
select tests.set_id('vor_47h', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '50 hours', now() - interval '47 hours'));
select tests.set_id('vor_49h', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '52 hours', now() - interval '49 hours'));
select tests.set_id('zeitraum', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '1 day', now() + interval '1 day'));

select tests.set_id('v_zukunft', tests.create_voucher(tests.id('zukunft'), tests.id('mia')));
select tests.set_id('v_laeuft', tests.create_voucher(tests.id('laeuft'), tests.id('mia')));
select tests.set_id('v_47h', tests.create_voucher(tests.id('vor_47h'), tests.id('mia')));
select tests.set_id('v_49h', tests.create_voucher(tests.id('vor_49h'), tests.id('mia')));
select tests.set_id('v_zeitraum', tests.create_voucher(tests.id('zeitraum'), tests.id('mia')));

-- Limit für diesen Test: 3 No-Shows → 10 Tage Sperre
update public.settings set no_show_limit = 3, block_days = 10;

select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(format('select public.mark_no_show(%L)', tests.id('v_zukunft')), 'P0001', 'NO_SHOW_ZU_FRUEH', 'vor Beginn');
select throws_ok(format('select public.mark_no_show(%L)', tests.id('v_49h')), 'P0001', 'NO_SHOW_ZU_SPAET', 'mehr als 48 Std. nach Ende');
select throws_ok(format('select public.mark_no_show(%L)', tests.id('v_zeitraum')), 'P0001', 'NO_SHOW_NUR_EINZELTERMIN', 'Zeitraum hat keine No-Shows');
select throws_ok(format('select public.mark_no_show(%L)', gen_random_uuid()), 'P0001', 'CODE_NICHT_GEFUNDEN', 'unbekannter Code');

select is((select user_blocked from public.mark_no_show(tests.id('v_laeuft'))), false, '1. No-Show: keine Sperre');
select throws_ok(format('select public.mark_no_show(%L)', tests.id('v_laeuft')), 'P0001', 'CODE_NICHT_AKTIV', 'nicht doppelt');
select is((select user_blocked from public.mark_no_show(tests.id('v_47h'))), false, '2. No-Show (47 Std. nach Ende): noch keine Sperre');

select tests.authenticate_as(tests.id('fremd_user'));
select throws_ok(format('select public.mark_no_show(%L)', tests.id('v_zukunft')), 'P0001', 'CODE_NICHT_GEFUNDEN', 'fremder Standort');

select tests.clear_authentication();
select is((select no_show_count from public.profiles where id = tests.id('mia')), 2, 'Zähler steht auf 2');
select is((select count(*)::int from public.events where type = 'no_show' and user_id = tests.id('mia')), 2, 'Event no_show');

-- 3. No-Show sperrt für 10 Tage, Zähler zurück auf 0
select tests.set_id('laeuft2', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '10 minutes', now() + interval '1 hour'));
select tests.set_id('v_laeuft2', tests.create_voucher(tests.id('laeuft2'), tests.id('mia')));
select tests.authenticate_as(tests.id('loc_user'));
select is((select user_blocked from public.mark_no_show(tests.id('v_laeuft2'))), true, '3. No-Show sperrt');
select tests.clear_authentication();
select is((select no_show_count from public.profiles where id = tests.id('mia')), 0, 'Zähler nach Sperre zurückgesetzt');
select ok(
  (select blocked_until between now() + interval '10 days' - interval '1 minute' and now() + interval '10 days' + interval '1 minute'
   from public.profiles where id = tests.id('mia')),
  'Sperre für block_days = 10 Tage'
);
select is((select status::text from public.vouchers where id = tests.id('v_laeuft2')), 'no_show', 'Status no_show');
select is((select seats_taken from public.offers where id = tests.id('laeuft2')), 1, 'No-Show-Platz bleibt belegt');

select * from finish();
