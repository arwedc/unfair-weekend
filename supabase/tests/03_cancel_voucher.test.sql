-- cancel_voucher: Storno-Frist (Einzeltermin), Zeitraum jederzeit, Plätze zurück
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));

-- Storno-Frist 3 Std. (Standard)
select is((select cancel_deadline_hours from public.settings), 3, 'Standard-Storno-Frist: 3 Std.');

select tests.set_id('frueh', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '3 hours 5 minutes', now() + interval '5 hours'));
select tests.set_id('knapp', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '2 hours 55 minutes', now() + interval '5 hours'));
select tests.set_id('zeitraum', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '1 day', now() + interval '1 hour'));
select tests.set_id('zr_vorbei', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '3 days', now() - interval '1 minute'));

select tests.set_id('v_frueh', tests.create_voucher(tests.id('frueh'), tests.id('mia'), 2));
select tests.set_id('v_knapp', tests.create_voucher(tests.id('knapp'), tests.id('mia'), 1));
select tests.set_id('v_zeitraum', tests.create_voucher(tests.id('zeitraum'), tests.id('mia'), 1));
select tests.set_id('v_zr_vorbei', tests.create_voucher(tests.id('zr_vorbei'), tests.id('mia'), 1));
select tests.set_id('v_jonas', tests.create_voucher(tests.id('frueh'), tests.id('jonas'), 1));

select tests.authenticate_as(tests.id('mia'));
select is(
  (select status::text from public.cancel_voucher(tests.id('v_frueh'))),
  'storniert', 'Einzeltermin: Storno vor der Frist'
);
select throws_ok(format('select public.cancel_voucher(%L)', tests.id('v_knapp')), 'P0001', 'FRIST_ABGELAUFEN', 'Einzeltermin: Storno nach der Frist');
select is(
  (select can_cancel from public.get_my_vouchers() where id = tests.id('v_knapp')),
  false, 'get_my_vouchers: can_cancel = false nach der Frist'
);
select lives_ok(format('select public.cancel_voucher(%L)', tests.id('v_zeitraum')), 'Zeitraum: Storno kurz vor Ende');
select throws_ok(format('select public.cancel_voucher(%L)', tests.id('v_zr_vorbei')), 'P0001', 'ANGEBOT_ABGELAUFEN', 'Zeitraum: nach dem Ende nicht mehr');
select throws_ok(format('select public.cancel_voucher(%L)', tests.id('v_frueh')), 'P0001', 'CODE_NICHT_AKTIV', 'doppelt stornieren');
select throws_ok(format('select public.cancel_voucher(%L)', tests.id('v_jonas')), 'P0001', 'CODE_NICHT_GEFUNDEN', 'fremden Code stornieren');

select tests.clear_authentication();
select is((select seats_taken from public.offers where id = tests.id('frueh')), 1, 'Plätze gehen zurück ins Kontingent');
select is(
  (select cancel_reason::text from public.vouchers where id = tests.id('v_frueh')),
  'nutzer', 'Grund: nutzer'
);
select isnt((select cancelled_at from public.vouchers where id = tests.id('v_frueh')), null, 'cancelled_at gesetzt');
select is(
  (select count(*)::int from public.events where type = 'code_storniert' and voucher_id in (tests.id('v_frueh'), tests.id('v_zeitraum'))),
  2, 'Event code_storniert'
);

-- Frist folgt der Admin-Einstellung
update public.settings set cancel_deadline_hours = 1;
select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.cancel_voucher(%L)', tests.id('v_knapp')), 'mit 1 Std. Frist wieder stornierbar');

select * from finish();
