-- Cron-Funktionen: Codes ablaufen lassen, Erinnerungen
select no_plan();

select is(
  (select count(*)::int from cron.job where jobname in ('unfair-expire-vouchers', 'unfair-enqueue-reminders') and schedule = '*/5 * * * *'),
  2, 'beide Cron-Jobs alle 5 Minuten'
);

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('mia', tests.create_nutzer('Mia'));

-- expire_vouchers
select tests.set_id('zr_vorbei', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '5 days', now() - interval '1 minute'));
select tests.set_id('zr_laeuft', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '5 days', now() + interval '1 hour'));
select tests.set_id('e_47h', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '50 hours', now() - interval '47 hours'));
select tests.set_id('e_49h', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '52 hours', now() - interval '49 hours'));
select tests.set_id('v1', tests.create_voucher(tests.id('zr_vorbei'), tests.id('mia')));
select tests.set_id('v2', tests.create_voucher(tests.id('zr_laeuft'), tests.id('mia')));
select tests.set_id('v3', tests.create_voucher(tests.id('e_47h'), tests.id('mia')));
select tests.set_id('v4', tests.create_voucher(tests.id('e_49h'), tests.id('mia')));
select tests.set_id('v5', tests.create_voucher(tests.id('zr_vorbei'), tests.create_nutzer('Jonas'), 1, 'eingeloest'));

select ok(private.expire_vouchers() >= 2, 'expire_vouchers läuft');
select is(
  (select array_agg(status::text order by k) from public.vouchers join tests.ids on v = vouchers.id where k in ('v1', 'v2', 'v3', 'v4', 'v5')),
  array['abgelaufen', 'aktiv', 'aktiv', 'abgelaufen', 'eingeloest'],
  'Zeitraum nach Ende und Einzeltermin 48 Std. nach Ende laufen ab; Rest bleibt'
);
select isnt((select expired_at from public.vouchers where id = tests.id('v1')), null, 'expired_at gesetzt');
select is((select profiles.no_show_count from public.profiles where id = tests.id('mia')), 0, 'Ablaufen ist keine Strafe');

-- enqueue_reminders (Standard: 2 Std. vorher)
select tests.set_id('bald', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '90 minutes', now() + interval '3 hours'));
select tests.set_id('spaeter', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '3 hours', now() + interval '4 hours'));
select tests.set_id('zr_bald', tests.create_offer(tests.id('loc'), 'zeitraum', now() + interval '1 hour', now() + interval '1 day'));
select tests.set_id('r1', tests.create_voucher(tests.id('bald'), tests.id('mia')));
update public.vouchers set claimed_at = now() - interval '1 day' where id = tests.id('r1');
select tests.set_id('r2', tests.create_voucher(tests.id('bald'), tests.create_nutzer('Spät')));
select tests.set_id('r3', tests.create_voucher(tests.id('spaeter'), tests.id('mia')));
update public.vouchers set claimed_at = now() - interval '1 day' where id = tests.id('r3');
select tests.set_id('r4', tests.create_voucher(tests.id('zr_bald'), tests.id('mia')));
update public.vouchers set claimed_at = now() - interval '1 day' where id = tests.id('r4');

create function pg_temp.reminders() returns integer language sql as $$
  select count(*)::int from public.notification_outbox
  where type = 'erinnerung' and offer_id in (tests.id('bald'), tests.id('spaeter'), tests.id('zr_bald'))
$$;
select lives_ok('select private.enqueue_reminders()', 'enqueue_reminders läuft');
select is(pg_temp.reminders(), 1, 'genau eine Erinnerung für die Test-Angebote');
select is(
  (select voucher_id from public.notification_outbox where type = 'erinnerung' and offer_id in (tests.id('bald'), tests.id('spaeter'), tests.id('zr_bald'))),
  tests.id('r1'), 'nur der früh geholte Code im 2-Std.-Fenster (kein Zeitraum, nicht der spät geholte)'
);
select is(
  (select payload ->> 'short_code' from public.notification_outbox where voucher_id = tests.id('r1')),
  (select short_code from public.vouchers where id = tests.id('r1')),
  'Payload enthält den Kurzcode'
);
select lives_ok('select private.enqueue_reminders()', 'zweiter Lauf');
select is(pg_temp.reminders(), 1, 'keine doppelten Erinnerungen');

update public.settings set reminder_hours_before = 0;
delete from public.notification_outbox where voucher_id = tests.id('r1');
select is(private.enqueue_reminders(), 0, 'Erinnerungen abschaltbar (0 Std.)');

select * from finish();
