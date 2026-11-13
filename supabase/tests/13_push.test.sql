-- Push: Outbox für neue Angebote, Worker-RPCs (claim/finish), Cron-Job
select no_plan();

-- ---------------------------------------------------------------------------
-- Aufbau
--   fan_ort:   Lieblingsort, Gerät
--   fan_kat:   Lieblingskategorie kreativ_workshops, Gerät
--   fan_beide: Lieblingsort UND Kategorie, Gerät
--   ohne:      Lieblingsort, kein Gerät
--   fremd:     Gerät, keine Favoriten
-- ---------------------------------------------------------------------------
select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_pending', tests.create_location('pending'));
select tests.set_id('fan_ort', tests.create_nutzer('TEST Push Ort'));
select tests.set_id('fan_kat', tests.create_nutzer('TEST Push Kategorie'));
select tests.set_id('fan_beide', tests.create_nutzer('TEST Push Beide'));
select tests.set_id('ohne', tests.create_nutzer('TEST Push Ohne'));
select tests.set_id('fremd', tests.create_nutzer('TEST Push Fremd'));

insert into public.favorite_locations (user_id, location_id) values
  (tests.id('fan_ort'), tests.id('loc')),
  (tests.id('fan_beide'), tests.id('loc')),
  (tests.id('ohne'), tests.id('loc')),
  (tests.id('fan_ort'), tests.id('loc_pending'));
insert into public.favorite_categories (user_id, category) values
  (tests.id('fan_kat'), 'kreativ_workshops'),
  (tests.id('fan_beide'), 'kreativ_workshops');
insert into public.push_tokens (user_id, token, platform) values
  (tests.id('fan_ort'), 'ExponentPushToken[test-ort]', 'ios'),
  (tests.id('fan_kat'), 'ExponentPushToken[test-kat]', 'ios'),
  (tests.id('fan_beide'), 'ExponentPushToken[test-beide]', 'android'),
  (tests.id('fremd'), 'ExponentPushToken[test-fremd]', 'ios');

-- Schon vorhandene fällige Einträge beiseiteschieben (nur in dieser Transaktion)
update public.notification_outbox set next_attempt_at = now() + interval '1 day'
where status in ('pending', 'processing');

-- Hilfsabfrage: Outbox-Einträge eines Angebots für einen Testnutzer
create temp view test_outbox as
select o.*, (select i.k from tests.ids i where i.v = o.recipient_user_id) as who
from public.notification_outbox o
where o.recipient_user_id in (
  tests.id('fan_ort'), tests.id('fan_kat'), tests.id('fan_beide'), tests.id('ohne'), tests.id('fremd')
);

-- Angebot direkt anlegen (Kategorie frei wählbar)
create function pg_temp.new_offer(p_location uuid, p_title text, p_status public.offer_status default 'aktiv')
returns uuid language sql as $$
  insert into public.offers (
    location_id, title, description, category, image_paths, original_price_cents,
    deal_price_cents, capacity, address, lat, lng, type, starts_at, ends_at, status
  ) values (
    p_location, p_title, 'Ein Workshop für den Push-Test.', 'kreativ_workshops',
    array['test/bild.jpg'], 4000, 2400, 10, 'Prinzipalmarkt 1, 48143 Münster', 51.9625, 7.628,
    'einzeltermin', now() + interval '3 days', now() + interval '3 days 2 hours', p_status
  ) returning id;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: neues Angebot
-- ---------------------------------------------------------------------------
select tests.set_id('offer', pg_temp.new_offer(tests.id('loc'), 'TEST Push Keramik'));

select is(
  (select count(*)::int from test_outbox where offer_id = tests.id('offer') and type = 'neues_angebot'),
  3,
  'Neues Angebot: Einträge für Ort-Fan, Kategorie-Fan und Beides-Fan'
);
select is(
  (select count(*)::int from test_outbox where offer_id = tests.id('offer') and who = 'fan_beide'),
  1,
  'Wer Ort und Kategorie mag, bekommt nur einen Eintrag'
);
select is(
  (select payload ->> 'reason' from test_outbox where offer_id = tests.id('offer') and who = 'fan_beide'),
  'standort',
  'Grund: der Lieblingsort hat Vorrang'
);
select is(
  (select payload ->> 'reason' from test_outbox where offer_id = tests.id('offer') and who = 'fan_kat'),
  'kategorie',
  'Grund beim Kategorie-Fan: kategorie'
);
select is(
  (select (payload ->> 'discount_percent')::int from test_outbox where offer_id = tests.id('offer') and who = 'fan_ort'),
  40,
  'Rabatt wie in list_offers (4000 → 2400 = 40 %)'
);
select is(
  (select payload ->> 'offer_title' from test_outbox where offer_id = tests.id('offer') and who = 'fan_ort'),
  'TEST Push Keramik',
  'Payload enthält den Titel'
);
select is(
  (select count(*)::int from test_outbox where offer_id = tests.id('offer') and who in ('ohne', 'fremd')),
  0,
  'Ohne Gerät oder ohne Favorit kein Eintrag'
);
select ok(
  (select bool_and(voucher_id is null) from test_outbox where offer_id = tests.id('offer')),
  'Einträge „neues Angebot“ haben keinen Code'
);

select throws_ok(
  format(
    $sql$insert into public.notification_outbox (type, recipient_user_id, offer_id)
         values ('neues_angebot', %L, %L)$sql$,
    tests.id('fan_kat'), tests.id('offer')
  ),
  '23505',
  null,
  'Pro Nutzer und Angebot höchstens ein Push „neues Angebot“'
);

select tests.set_id('offer_pending', pg_temp.new_offer(tests.id('loc_pending'), 'TEST Push Wartet'));
select is(
  (select count(*)::int from test_outbox where offer_id = tests.id('offer_pending')),
  0,
  'Standort nicht freigeschaltet: kein Push'
);

select tests.set_id('offer_abgesagt', pg_temp.new_offer(tests.id('loc'), 'TEST Push Abgesagt', 'abgesagt'));
select is(
  (select count(*)::int from test_outbox where offer_id = tests.id('offer_abgesagt')),
  0,
  'Angebot nicht aktiv: kein Push'
);

-- ---------------------------------------------------------------------------
-- Rechte: Worker-RPCs nur für service_role
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.claim_push_batch(integer)', 'execute'),
  'anon darf claim_push_batch nicht');
select ok(not has_function_privilege('authenticated', 'public.claim_push_batch(integer)', 'execute'),
  'Nutzer dürfen claim_push_batch nicht');
select ok(not has_function_privilege('authenticated', 'public.finish_push_batch(bigint[], jsonb, text[])', 'execute'),
  'Nutzer dürfen finish_push_batch nicht');
select ok(has_function_privilege('service_role', 'public.claim_push_batch(integer)', 'execute'),
  'service_role darf claim_push_batch');
select ok(has_function_privilege('service_role', 'public.finish_push_batch(bigint[], jsonb, text[])', 'execute'),
  'service_role darf finish_push_batch');

-- ---------------------------------------------------------------------------
-- claim_push_batch
-- ---------------------------------------------------------------------------
-- Absage an jemanden ohne Gerät
insert into public.notification_outbox (type, recipient_user_id, offer_id, voucher_id, payload)
values ('angebot_abgesagt', tests.id('ohne'), tests.id('offer'),
        tests.create_voucher(tests.id('offer'), tests.id('ohne')), '{}'::jsonb);
-- Erinnerung, deren Termin schon begonnen hat
insert into public.notification_outbox (type, recipient_user_id, offer_id, voucher_id, payload)
values ('erinnerung', tests.id('fan_kat'), tests.id('offer'),
        tests.create_voucher(tests.id('offer'), tests.id('fan_kat')),
        jsonb_build_object('starts_at', now() - interval '5 minutes'));
-- Neues Angebot, das schon über einen Tag wartet
insert into public.notification_outbox (type, recipient_user_id, offer_id, created_at)
values ('neues_angebot', tests.id('fremd'), tests.id('offer_abgesagt'), now() - interval '25 hours');
-- Hängengeblieben: fünfmal abgeholt, nie zurückgemeldet
insert into public.notification_outbox (type, recipient_user_id, offer_id, status, attempts, next_attempt_at)
values ('neues_angebot', tests.id('fremd'), tests.id('offer_pending'), 'processing', 5, now() - interval '1 minute');

create temp table claimed as select * from public.claim_push_batch(500);

select is(
  (select count(*)::int from claimed where recipient_id in (tests.id('fan_ort'), tests.id('fan_kat'), tests.id('fan_beide'))),
  3,
  'Abgeholt: die drei Einträge „neues Angebot“ mit Gerät'
);
select is(
  (select tokens from claimed where recipient_id = tests.id('fan_beide')),
  array['ExponentPushToken[test-beide]'],
  'Abgeholte Einträge bringen die Push-Tokens mit'
);
select ok(
  (select bool_and(status = 'processing' and attempts = 1 and next_attempt_at > now())
   from test_outbox where id in (select outbox_id from claimed)),
  'Abgeholt: processing, Versuch 1, vorerst nicht wieder fällig'
);
select is(
  (select last_error from test_outbox where type = 'angebot_abgesagt' and who = 'ohne'),
  'KEIN_GERAET',
  'Ohne Gerät: failed mit KEIN_GERAET'
);
select is(
  (select last_error from test_outbox where type = 'erinnerung' and who = 'fan_kat'),
  'ZU_SPAET',
  'Erinnerung nach Beginn: failed mit ZU_SPAET'
);
select is(
  (select last_error from test_outbox where offer_id = tests.id('offer_abgesagt') and who = 'fremd'),
  'ZU_SPAET',
  'Neues Angebot nach 24 Std.: failed mit ZU_SPAET'
);
select is(
  (select last_error from test_outbox where offer_id = tests.id('offer_pending') and who = 'fremd'),
  'ABGEBROCHEN',
  'Fünfmal abgeholt ohne Rückmeldung: failed mit ABGEBROCHEN'
);
select is(
  (select count(*)::int from public.claim_push_batch(500) c where c.outbox_id in (select outbox_id from claimed)),
  0,
  'Direkt danach wird nichts doppelt abgeholt'
);

-- ---------------------------------------------------------------------------
-- finish_push_batch
-- ---------------------------------------------------------------------------
-- Outbox-IDs sind bigint und passen nicht in tests.ids (uuid), deshalb eine eigene Tabelle
create temp table ids as
select
  (select outbox_id from claimed where recipient_id = tests.id('fan_ort')) as ort,
  (select outbox_id from claimed where recipient_id = tests.id('fan_kat')) as kat,
  (select outbox_id from claimed where recipient_id = tests.id('fan_beide')) as beide;

create temp table result as
select public.finish_push_batch(
  array[(select ort from ids)],
  jsonb_build_array(
    jsonb_build_object('id', (select kat from ids), 'error', 'MessageRateExceeded', 'retry', true),
    jsonb_build_object('id', (select beide from ids), 'error', 'DeviceNotRegistered', 'retry', false)
  ),
  array['ExponentPushToken[test-beide]']
) as r;

select is(
  (select r from result),
  '{"sent": 1, "retry": 1, "failed": 1, "tokens_removed": 1}'::jsonb,
  'Rückmeldung zählt verschickt, erneut, fehlgeschlagen und gelöschte Tokens'
);
select ok(
  (select status = 'sent' and sent_at is not null from public.notification_outbox where id = (select ort from ids)),
  'Verschickt: status sent mit Zeitstempel'
);
select ok(
  (select status = 'pending' and next_attempt_at > now() and last_error = 'MessageRateExceeded'
   from public.notification_outbox where id = (select kat from ids)),
  'Vorübergehender Fehler: wieder pending, später erneut'
);
select ok(
  (select status = 'failed' from public.notification_outbox where id = (select beide from ids)),
  'Dauerhafter Fehler: failed'
);
select is(
  (select count(*)::int from public.push_tokens where token = 'ExponentPushToken[test-beide]'),
  0,
  'Ungültiges Token wird gelöscht'
);

-- Nach fünf Versuchen ist Schluss, auch bei vorübergehenden Fehlern
update public.notification_outbox set status = 'processing', attempts = 5 where id = (select kat from ids);
select public.finish_push_batch('{}', jsonb_build_array(jsonb_build_object('id', (select kat from ids), 'error', 'X')), '{}');
select is(
  (select status::text from public.notification_outbox where id = (select kat from ids)),
  'failed',
  'Ab Versuch 5 endgültig failed'
);

select throws_ok(
  $sql$select public.finish_push_batch('{}', '{"id": 1}'::jsonb, '{}')$sql$,
  'P0001',
  'UNGUELTIGE_EINGABE',
  'p_failed muss eine Liste sein'
);

-- ---------------------------------------------------------------------------
-- Cron und pg_net
-- ---------------------------------------------------------------------------
select ok(exists (select 1 from pg_extension where extname = 'pg_net'), 'pg_net ist installiert');
select is(
  (select count(*)::int from cron.job where jobname = 'unfair-send-push'),
  1,
  'Cron-Job unfair-send-push existiert'
);

update public.notification_outbox set next_attempt_at = now() + interval '1 day'
where status in ('pending', 'processing');
select is(private.invoke_push_worker(), null, 'Nichts fällig: kein Aufruf der Edge Function');

select * from finish();
