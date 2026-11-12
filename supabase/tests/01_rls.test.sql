-- RLS und Rechte je Rolle: anon, Nutzer, Standort, Admin
select no_plan();

-- RLS ist auf jeder Tabelle in public aktiv
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS ist auf allen Tabellen in public aktiv'
);

-- Fixtures
select tests.set_id('loc_a', tests.create_location('approved'));
select tests.set_id('loc_b', tests.create_location('approved'));
select tests.set_id('user_a', tests.location_user(tests.id('loc_a')));
select tests.set_id('user_b', tests.location_user(tests.id('loc_b')));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));
select tests.set_id('admin', tests.create_admin());
select tests.set_id('offer_a', tests.create_offer(tests.id('loc_a')));
select tests.set_id('offer_b', tests.create_offer(tests.id('loc_b')));
select tests.set_id('v_mia', tests.create_voucher(tests.id('offer_a'), tests.id('mia')));
select tests.set_id('v_jonas', tests.create_voucher(tests.id('offer_b'), tests.id('jonas')));
insert into public.notification_outbox (type, recipient_user_id, offer_id, voucher_id)
values ('erinnerung', tests.id('mia'), tests.id('offer_a'), tests.id('v_mia'));

-- ---------------------------------------------------------------------------
-- anon: nur settings, sonst keine Tabelle
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select is((select count(*)::int from public.settings), 1, 'anon: settings lesbar');
select throws_ok('select * from public.profiles', '42501', null, 'anon: profiles gesperrt');
select throws_ok('select * from public.offers', '42501', null, 'anon: offers gesperrt');
select throws_ok('select * from public.vouchers', '42501', null, 'anon: vouchers gesperrt');
select throws_ok('select * from public.locations', '42501', null, 'anon: locations gesperrt');
select throws_ok('select * from public.events', '42501', null, 'anon: events gesperrt');
select throws_ok('select public.claim_voucher(gen_random_uuid(), 1)', '42501', null, 'anon: claim_voucher nicht aufrufbar');
select throws_ok('select public.get_my_account()', '42501', null, 'anon: get_my_account nicht aufrufbar');

-- ---------------------------------------------------------------------------
-- Nutzer: nur eigenes Profil, eigene Codes, eigene Favoriten
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('mia'));
select is((select count(*)::int from public.profiles), 1, 'Nutzer: sieht nur das eigene Profil');
select is((select id from public.profiles), tests.id('mia'), 'Nutzer: eigenes Profil');
select is((select count(*)::int from public.vouchers), 1, 'Nutzer: sieht nur eigene Codes');
select is((select id from public.vouchers), tests.id('v_mia'), 'Nutzer: eigener Code');
select is((select count(*)::int from public.offers), 0, 'Nutzer: keine Angebote direkt');
select is((select count(*)::int from public.locations), 0, 'Nutzer: keine Standorte direkt');
select is((select count(*)::int from public.companies), 0, 'Nutzer: keine Unternehmen direkt');
select throws_ok('select * from public.notification_outbox', '42501', null, 'Nutzer: Outbox gesperrt');
select throws_ok('select * from public.geocode_cache', '42501', null, 'Nutzer: Geocode-Cache gesperrt');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = tests.id('mia') $$,
  '42501', null, 'Nutzer: kann die eigene Rolle nicht ändern'
);
select throws_ok(
  $$ update public.vouchers set status = 'eingeloest' where id = tests.id('v_mia') $$,
  '42501', null, 'Nutzer: kann Codes nicht direkt ändern'
);
select lives_ok(
  $$ insert into public.favorite_locations (user_id, location_id) values (tests.id('mia'), tests.id('loc_a')) $$,
  'Nutzer: eigenen Favoriten anlegen'
);
select lives_ok(
  $$ insert into public.favorite_categories (user_id, category) values (tests.id('mia'), 'kochen_essen') $$,
  'Nutzer: Lieblingskategorie anlegen'
);
select throws_ok(
  $$ insert into public.favorite_locations (user_id, location_id) values (tests.id('jonas'), tests.id('loc_a')) $$,
  '42501', null, 'Nutzer: Favorit für andere anlegen geht nicht'
);
select is((select count(*)::int from public.favorite_locations), 1, 'Nutzer: sieht eigene Favoriten');

select tests.authenticate_as(tests.id('jonas'));
select is((select count(*)::int from public.favorite_locations), 0, 'Anderer Nutzer: sieht fremde Favoriten nicht');
select lives_ok('delete from public.favorite_categories', 'Anderer Nutzer: Löschversuch ohne Fehler');
select tests.authenticate_as(tests.id('mia'));
select is(
  (select count(*)::int from public.favorite_categories),
  1, 'Fremde Favoriten wurden nicht gelöscht'
);

-- ---------------------------------------------------------------------------
-- Standort: nur eigener Standort, eigene Angebote und deren Codes
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('user_a'));
select is((select count(*)::int from public.locations), 1, 'Standort: sieht nur den eigenen Standort');
select is((select id from public.locations), tests.id('loc_a'), 'Standort: eigener Standort');
select is((select count(*)::int from public.companies), 1, 'Standort: sieht nur das eigene Unternehmen');
select is((select count(*)::int from public.offers), 1, 'Standort: sieht nur eigene Angebote');
select is((select id from public.offers), tests.id('offer_a'), 'Standort: eigenes Angebot');
select is((select count(*)::int from public.vouchers), 1, 'Standort: sieht nur Codes eigener Angebote');
select is((select id from public.vouchers), tests.id('v_mia'), 'Standort: Code zum eigenen Angebot');
select is((select count(*)::int from public.profiles), 1, 'Standort: sieht keine Nutzerprofile (nur das eigene)');
select throws_ok(
  $$ update public.offers set title = 'gehackt' where id = tests.id('offer_a') $$,
  '42501', null, 'Standort: Angebote nur per RPC ändern'
);
select throws_ok(
  $$ update public.locations set status = 'approved' where id = tests.id('loc_a') $$,
  '42501', null, 'Standort: kann den eigenen Status nicht ändern'
);
select is(
  (select count(*)::int from public.get_offer_participants(tests.id('offer_a'))),
  1, 'Standort: Teilnehmerliste des eigenen Angebots'
);
select throws_ok(
  format('select public.get_offer_participants(%L)', tests.id('offer_b')),
  'P0001', 'ANGEBOT_NICHT_GEFUNDEN', 'Standort: keine Teilnehmerliste fremder Angebote'
);

-- ---------------------------------------------------------------------------
-- Admin: liest alles
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin'));
select ok((select count(*) from public.locations where id in (tests.id('loc_a'), tests.id('loc_b'))) = 2, 'Admin: sieht alle Standorte');
select ok((select count(*) from public.offers where id in (tests.id('offer_a'), tests.id('offer_b'))) = 2, 'Admin: sieht alle Angebote');
select ok((select count(*) from public.vouchers where id in (tests.id('v_mia'), tests.id('v_jonas'))) = 2, 'Admin: sieht alle Codes');
select ok((select count(*) from public.profiles where id in (tests.id('mia'), tests.id('jonas'))) = 2, 'Admin: sieht alle Profile');
select is(
  (select count(*)::int from public.get_offer_participants(tests.id('offer_b'))),
  1, 'Admin: Teilnehmerliste jedes Angebots'
);
select throws_ok(
  $$ update public.settings set min_discount_percent = 5 $$,
  '42501', null, 'Admin: Einstellungen nur per RPC'
);

-- Teilnehmerliste enthält keine E-Mail
select tests.clear_authentication();
select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_offer_participants'
     and pg_get_function_result(p.oid) ilike '%email%'),
  0, 'Teilnehmerliste liefert keine E-Mail-Spalte'
);

select * from finish();
