-- Smoke-Test: jede RPC einmal auf dem Hauptweg plus die wichtigsten Fehlercodes.
-- Läuft in einer Transaktion (Savepoint) und wird zurückgerollt.

select plan(41);

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to anon, authenticated;
create function pg_temp.id(p_key text) returns uuid language sql stable as $$ select v from ids where k = p_key $$;
grant execute on function pg_temp.id(text) to anon, authenticated;

-- Fixtures (als postgres)
insert into ids values ('loc', tests.create_location('approved'));
insert into ids values ('loc_user', tests.location_user(pg_temp.id('loc')));
insert into ids values ('nutzer', tests.create_nutzer('Mia'));
insert into ids values ('nutzer2', tests.create_nutzer('Jonas'));
insert into ids values ('admin', tests.create_admin());
insert into ids values ('offer', tests.create_offer(pg_temp.id('loc')));
insert into ids values ('zeitraum', tests.create_offer(pg_temp.id('loc'), 'zeitraum', now() - interval '1 day', now() + interval '5 days'));

-- ---------------------------------------------------------------------------
-- Öffentlich (anon)
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select is(
  (select free_seats from public.list_offers() where id = pg_temp.id('offer')),
  10, 'anon: Feed zeigt Angebot mit 10 freien Plätzen'
);
select is(
  (select count(*)::int from public.get_offer(pg_temp.id('offer'))),
  1, 'anon: get_offer liefert das Angebot'
);
select lives_ok($$ select public.log_offer_view(pg_temp.id('offer')) $$, 'anon: log_offer_view');
select is((select count(*)::int from public.settings), 1, 'anon: settings lesbar');
select is(
  tests.error_code($$ select * from public.offers $$),
  'permission denied for table offers', 'anon: kein direkter Tabellenzugriff auf offers'
);

-- ---------------------------------------------------------------------------
-- Nutzer: Code holen, Fehlerfälle, eigene Codes, stornieren
-- ---------------------------------------------------------------------------
select tests.authenticate_as(pg_temp.id('nutzer'));
select is((public.get_my_account() ->> 'role'), 'nutzer', 'get_my_account: Rolle nutzer');
select is((public.get_my_account() ->> 'profile_complete')::boolean, true, 'get_my_account: Profil vollständig');

select is(
  (select seats from public.claim_voucher(pg_temp.id('offer'), 2)),
  2, 'claim_voucher: 2 Plätze geholt'
);
select is(
  tests.error_code($$ select public.claim_voucher(pg_temp.id('offer'), 1) $$),
  'BEREITS_AKTIVER_CODE', 'claim_voucher: zweiter aktiver Code wird abgelehnt'
);
select is(
  tests.error_code($$ select public.claim_voucher(pg_temp.id('zeitraum'), 3) $$),
  'ZU_VIELE_PLAETZE', 'claim_voucher: mehr als max_per_user'
);
select is(
  (select free_seats from public.list_offers() where id = pg_temp.id('offer')),
  8, 'Feed: 8 freie Plätze nach dem Holen'
);
select matches(
  (select short_code from public.get_my_vouchers() limit 1),
  '^[A-Z2-9]{3}-[A-Z2-9]{3}$', 'get_my_vouchers: Kurzcode im Format XXX-XXX'
);
select is(
  (select can_cancel from public.get_my_vouchers() limit 1),
  true, 'get_my_vouchers: stornierbar (Start in 2 Tagen)'
);
select is(
  (select count(*)::int from public.offers),
  0, 'RLS: Nutzer sieht die Tabelle offers nicht direkt'
);
select is(
  (select status::text from public.cancel_voucher((select id from public.get_my_vouchers() limit 1))),
  'storniert', 'cancel_voucher: storniert'
);
select is(
  (select free_seats from public.list_offers() where id = pg_temp.id('offer')),
  10, 'Feed: Plätze sind zurück im Kontingent'
);

-- ---------------------------------------------------------------------------
-- Standort: Angebote anlegen/ändern, Einlösen zu früh, Absage mit Outbox
-- ---------------------------------------------------------------------------
select tests.authenticate_as(pg_temp.id('nutzer'));
select lives_ok($$ select public.claim_voucher(pg_temp.id('offer'), 1) $$, 'Nutzer holt erneut einen Code');

select tests.authenticate_as(pg_temp.id('loc_user'));
select is(
  tests.error_code(format('select public.redeem_voucher(%L)', (select short_code from public.vouchers where offer_id = pg_temp.id('offer') and status = 'aktiv'))),
  'EINLOESUNG_ZU_FRUEH', 'redeem_voucher: zu früh (Termin in 2 Tagen)'
);
select is(
  (select first_name from public.get_offer_participants(pg_temp.id('offer')) where status = 'aktiv'),
  'Mia', 'Teilnehmerliste: Vorname'
);
select is(
  (select last_initial from public.get_offer_participants(pg_temp.id('offer')) where status = 'aktiv'),
  'A', 'Teilnehmerliste: Initial des Nachnamens'
);

insert into ids
select 'rpc_offer', (public.create_offer(
  'TEST AUTOTEST Pasta-Kurs', 'Frische Pasta mit Nonna, inklusive Wein.', 'kochen_essen',
  array['loc/bild-1.jpg', 'loc/bild-2.jpg'], 5000, 3000, 12, 2,
  'Prinzipalmarkt 1, 48143 Münster', 51.9625, 7.6280, 'einzeltermin',
  now() + interval '3 days', now() + interval '3 days 3 hours'
)).id;
select isnt(pg_temp.id('rpc_offer'), null, 'create_offer: Angebot angelegt');
select is(
  tests.error_code($$ select public.create_offer('TEST AUTOTEST Billig', 'Kaum Rabatt bei diesem Angebot.', 'sonstiges', array['x.jpg'], 5000, 4500, 5, 1, 'Prinzipalmarkt 1, Münster', 51.96, 7.62, 'einzeltermin', now() + interval '1 day', now() + interval '1 day 1 hour') $$),
  'RABATT_ZU_GERING', 'create_offer: Mindestrabatt wird geprüft'
);
select is(
  (select title from public.update_offer(
    pg_temp.id('offer'), 'TEST AUTOTEST Neuer Titel', 'Automatisch erzeugtes Testangebot.', 'kochen_essen',
    array['test/bild-1.jpg'], 4000, 2400, 12, 2, 'Prinzipalmarkt 1, 48143 Münster', 51.9625, 7.6280,
    'einzeltermin', (select starts_at from public.offers where id = pg_temp.id('offer')),
    (select ends_at from public.offers where id = pg_temp.id('offer'))
  )),
  'TEST AUTOTEST Neuer Titel', 'update_offer: Titel und Kontingent geändert'
);
select is(
  tests.error_code(format(
    $f$ select public.update_offer(%L, 'TEST AUTOTEST Neuer Titel', 'Automatisch erzeugtes Testangebot.', 'kochen_essen', array['test/bild-1.jpg'], 4000, 2000, 12, 2, 'Prinzipalmarkt 1, 48143 Münster', 51.9625, 7.6280, 'einzeltermin', now() + interval '2 days', now() + interval '2 days 3 hours') $f$,
    pg_temp.id('offer'))),
  'FELD_GESPERRT', 'update_offer: Preise gesperrt, sobald Codes existieren'
);
select is(
  (public.cancel_offer(pg_temp.id('offer'), 'Krankheit') ->> 'cancelled_vouchers')::int,
  1, 'cancel_offer: aktiver Code storniert'
);

select tests.clear_authentication();
select is(
  (select count(*)::int from public.notification_outbox where offer_id = pg_temp.id('offer') and type = 'angebot_abgesagt'),
  1, 'cancel_offer: Outbox-Eintrag für den Code-Inhaber'
);

-- ---------------------------------------------------------------------------
-- Registrierung und Freischaltung
-- ---------------------------------------------------------------------------
insert into ids values ('neu_user', tests.create_user('autotest+neu@example.com', '{"account_type":"standort"}'));
select tests.authenticate_as(pg_temp.id('neu_user'));
insert into ids select 'neu_loc', (public.register_company(
  'TEST AUTOTEST Neue Firma', 'TEST AUTOTEST Neuer Standort', 'Ludgeristraße 1', '48143', 'Münster'
) ->> 'location_id')::uuid;
select is((public.get_my_account() -> 'location' ->> 'status'), 'pending', 'register_company: Status pending');
select is(
  tests.error_code($$ select public.create_offer('TEST AUTOTEST Zu früh', 'Noch nicht freigeschaltet.', 'sonstiges', array['x.jpg'], 5000, 3000, 5, 1, 'Ludgeristraße 1, Münster', 51.96, 7.62, 'einzeltermin', now() + interval '1 day', now() + interval '1 day 1 hour') $$),
  'STANDORT_NICHT_FREIGESCHALTET', 'create_offer: erst nach Freischaltung'
);
select tests.authenticate_as(pg_temp.id('admin'));
select is((select status::text from public.approve_location(pg_temp.id('neu_loc'))), 'approved', 'approve_location: freigeschaltet');
select tests.authenticate_as(pg_temp.id('nutzer'));
select is(
  tests.error_code($$ select public.approve_location(pg_temp.id('neu_loc')) $$),
  'KEIN_ZUGRIFF', 'approve_location: nur Admins'
);

-- ---------------------------------------------------------------------------
-- Laufender Termin: Einlösen und No-Show mit Sperre
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
insert into ids values ('laufend', tests.create_offer(pg_temp.id('loc'), 'einzeltermin', now() - interval '1 hour', now() + interval '1 hour'));
insert into public.vouchers (offer_id, user_id, seats, token, short_code)
select pg_temp.id('laufend'), u.v, 1, private.generate_token(), private.generate_short_code()
from ids u where u.k in ('nutzer', 'nutzer2');
update public.offers set seats_taken = 2 where id = pg_temp.id('laufend');

select tests.authenticate_as(pg_temp.id('loc_user'));
select is(
  (select first_name from public.redeem_voucher(
    lower(replace((select short_code from public.vouchers where offer_id = pg_temp.id('laufend') and user_id = pg_temp.id('nutzer2')), '-', ''))
  )),
  'Jonas', 'redeem_voucher: Kurzcode klein und ohne Bindestrich'
);
select is(
  (select user_blocked from public.mark_no_show((select id from public.vouchers where offer_id = pg_temp.id('laufend') and user_id = pg_temp.id('nutzer')))),
  false, 'mark_no_show: erster No-Show, noch keine Sperre'
);

select tests.clear_authentication();
insert into ids values ('laufend2', tests.create_offer(pg_temp.id('loc'), 'einzeltermin', now() - interval '30 minutes', now() + interval '1 hour'));
insert into public.vouchers (offer_id, user_id, seats, token, short_code)
values (pg_temp.id('laufend2'), pg_temp.id('nutzer'), 1, private.generate_token(), private.generate_short_code());
update public.offers set seats_taken = 1 where id = pg_temp.id('laufend2');

select tests.authenticate_as(pg_temp.id('loc_user'));
select is(
  (select user_blocked from public.mark_no_show((select id from public.vouchers where offer_id = pg_temp.id('laufend2')))),
  true, 'mark_no_show: zweiter No-Show sperrt'
);

select tests.authenticate_as(pg_temp.id('nutzer'));
select is(
  tests.error_code($$ select public.claim_voucher(pg_temp.id('zeitraum'), 1) $$),
  'GESPERRT', 'claim_voucher: gesperrter Nutzer'
);
select is((public.get_my_account() ->> 'no_show_count')::int, 0, 'Sperre setzt den No-Show-Zähler zurück');

-- ---------------------------------------------------------------------------
-- Admin-Kennzahlen, Cron-Funktionen
-- ---------------------------------------------------------------------------
select tests.authenticate_as(pg_temp.id('admin'));
select ok(
  (public.get_admin_metrics() -> 'totals' ->> 'claims')::int >= 2,
  'get_admin_metrics: Summen vorhanden'
);
select tests.clear_authentication();
select lives_ok($$ select private.expire_vouchers() $$, 'Cron: expire_vouchers');
select lives_ok($$ select private.enqueue_reminders() $$, 'Cron: enqueue_reminders');

-- ---------------------------------------------------------------------------
-- Konto löschen
-- ---------------------------------------------------------------------------
select tests.authenticate_as(pg_temp.id('nutzer2'));
select lives_ok($$ select public.delete_my_account() $$, 'delete_my_account');
select tests.clear_authentication();
select is((select count(*)::int from auth.users where id = pg_temp.id('nutzer2')), 0, 'Auth-Konto gelöscht');
select is(
  (select count(*)::int from public.vouchers where offer_id = pg_temp.id('laufend') and user_id is null and status = 'eingeloest'),
  1, 'Eingelöster Code bleibt anonym erhalten'
);

select * from finish();
