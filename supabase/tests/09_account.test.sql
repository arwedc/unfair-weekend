-- Profil, eigene Codes, Push-Tokens, Konto löschen
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('admin', tests.create_admin());
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));

-- Profil
select tests.authenticate_as(tests.id('mia'));
select is(
  (select first_name || ' ' || last_name from public.update_my_profile('  Mia ', ' Muster ')),
  'Mia Muster', 'update_my_profile trimmt'
);
select throws_ok($$ select public.update_my_profile('', 'Muster') $$, 'P0001', 'UNGUELTIGE_EINGABE', 'leerer Vorname');
select is(public.get_my_account() ->> 'location', null, 'Nutzer: keine Standortinfo');
select is((public.get_my_account() ->> 'is_blocked')::boolean, false, 'nicht gesperrt');

select tests.authenticate_as(tests.id('loc_user'));
select is(public.get_my_account() ->> 'role', 'standort', 'Standort: Rolle');
select is((public.get_my_account() -> 'location' ->> 'id')::uuid, tests.id('loc'), 'Standort: eigene location');

-- Push-Tokens: Gerät wechselt den Besitzer beim Anmelden
select tests.authenticate_as(tests.id('mia'));
select lives_ok($$ select public.register_push_token('ExponentPushToken[autotest]', 'ios') $$, 'Token registrieren');
select lives_ok($$ select public.register_push_token('ExponentPushToken[autotest]', 'ios') $$, 'erneut registrieren (idempotent)');
select is((select count(*)::int from public.push_tokens), 1, 'ein Token');
select throws_ok($$ select public.register_push_token('', 'ios') $$, 'P0001', 'UNGUELTIGE_EINGABE', 'leerer Token');
select tests.authenticate_as(tests.id('jonas'));
select lives_ok($$ select public.register_push_token('ExponentPushToken[autotest]', 'ios') $$, 'gleiches Gerät, anderes Konto');
select is((select count(*)::int from public.push_tokens), 1, 'Token gehört jetzt Jonas');
select tests.authenticate_as(tests.id('mia'));
select is((select count(*)::int from public.push_tokens), 0, 'Mia hat ihn nicht mehr');
select tests.authenticate_as(tests.id('jonas'));
select lives_ok($$ select public.unregister_push_token('ExponentPushToken[autotest]') $$, 'abmelden');
select is((select count(*)::int from public.push_tokens), 0, 'Token gelöscht');

-- get_my_vouchers: aktive zuerst
select tests.clear_authentication();
select tests.set_id('spaeter', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '5 days', now() + interval '5 days 1 hour'));
select tests.set_id('frueher', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '1 day', now() + interval '1 day 1 hour'));
select tests.set_id('alt', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '3 days', now() - interval '2 days'));
select tests.set_id('v_spaeter', tests.create_voucher(tests.id('spaeter'), tests.id('mia'), 2));
select tests.set_id('v_frueher', tests.create_voucher(tests.id('frueher'), tests.id('mia'), 1));
select tests.set_id('v_alt', tests.create_voucher(tests.id('alt'), tests.id('mia'), 1, 'eingeloest'));
insert into public.favorite_locations (user_id, location_id) values (tests.id('mia'), tests.id('loc'));
insert into public.push_tokens (user_id, token, platform) values (tests.id('mia'), 'ExponentPushToken[mia]', 'android');

select tests.authenticate_as(tests.id('mia'));
select is(
  (select array_agg(id) from public.get_my_vouchers()),
  array[tests.id('v_frueher'), tests.id('v_spaeter'), tests.id('v_alt')],
  'get_my_vouchers: aktive nach Termin, dann die übrigen'
);
select is((select location_name from public.get_my_vouchers() limit 1), 'TEST AUTOTEST Standort', 'mit Standortname');

-- Konto löschen
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok('select public.delete_my_account()', 'P0001', 'KONTO_NICHT_LOESCHBAR', 'Standort-Konto nicht selbst löschbar');
select tests.authenticate_as(tests.id('admin'));
select throws_ok('select public.delete_my_account()', 'P0001', 'KONTO_NICHT_LOESCHBAR', 'Admin-Konto nicht selbst löschbar');

select tests.authenticate_as(tests.id('mia'));
select lives_ok('select public.delete_my_account()', 'Nutzer löscht sein Konto');

select tests.clear_authentication();
select is((select count(*)::int from auth.users where id = tests.id('mia')), 0, 'Auth-Konto weg');
select is((select count(*)::int from public.profiles where id = tests.id('mia')), 0, 'Profil weg');
select is((select count(*)::int from public.favorite_locations where user_id = tests.id('mia')), 0, 'Favoriten weg');
select is((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[mia]'), 0, 'Push-Tokens weg');
select is(
  (select count(*)::int from public.vouchers
   where id in (tests.id('v_spaeter'), tests.id('v_frueher')) and status = 'storniert' and cancel_reason = 'konto_geloescht'),
  2, 'aktive Codes storniert (konto_geloescht)'
);
select is(
  (select count(*)::int from public.vouchers where id in (tests.id('v_spaeter'), tests.id('v_frueher'), tests.id('v_alt')) and user_id is null),
  3, 'Codes bleiben anonym erhalten'
);
select is((select seats_taken from public.offers where id = tests.id('spaeter')), 0, 'Plätze freigegeben');
select is((select count(*)::int from public.events where user_id = tests.id('mia')), 0, 'Events ohne Personenbezug');

select tests.authenticate_as(tests.id('loc_user'));
select is(
  (select first_name from public.get_offer_participants(tests.id('alt'))),
  'Gelöschtes Konto', 'Teilnehmerliste zeigt „Gelöschtes Konto“'
);

select * from finish();
