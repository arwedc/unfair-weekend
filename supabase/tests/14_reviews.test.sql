-- Bewertungen: nur mit eingelöstem Code, einmal pro Ort, öffentliche Liste, Durchschnitt, Admin blendet aus
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc2', tests.create_location('approved'));
select tests.set_id('loc_pending', tests.create_location('pending'));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));
select tests.set_id('admin', tests.create_admin());

select tests.set_id('offer', tests.create_offer(tests.id('loc')));
select tests.set_id('offer_b', tests.create_offer(tests.id('loc')));
select tests.set_id('offer2', tests.create_offer(tests.id('loc2')));
select tests.set_id('offer_p', tests.create_offer(tests.id('loc_pending')));

select tests.set_id('v_mia', tests.create_voucher(tests.id('offer'), tests.id('mia'), 1, 'eingeloest'));
select tests.set_id('v_mia_b', tests.create_voucher(tests.id('offer_b'), tests.id('mia'), 1, 'eingeloest'));
select tests.set_id('v_mia_aktiv', tests.create_voucher(tests.id('offer2'), tests.id('mia'), 1, 'aktiv'));
select tests.set_id('v_jonas', tests.create_voucher(tests.id('offer'), tests.id('jonas'), 1, 'eingeloest'));
select tests.set_id('v_jonas_p', tests.create_voucher(tests.id('offer_p'), tests.id('jonas'), 1, 'eingeloest'));

-- ---------------------------------------------------------------------------
-- create_review
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok(
  format('select public.create_review(%L, 5)', tests.id('v_mia')),
  '42501', null, 'Ohne Login: keine Ausführungsrechte'
);

select tests.authenticate_as(tests.id('mia'));
select throws_ok(format('select public.create_review(%L, 0)', tests.id('v_mia')), 'P0001', 'UNGUELTIGE_EINGABE', '0 Sterne geht nicht');
select throws_ok(format('select public.create_review(%L, 6)', tests.id('v_mia')), 'P0001', 'UNGUELTIGE_EINGABE', '6 Sterne gehen nicht');
select throws_ok(format('select public.create_review(%L, 5, %L)', tests.id('v_mia'), repeat('x', 1001)), 'P0001', 'UNGUELTIGE_EINGABE', 'Text über 1000 Zeichen');
select throws_ok(format('select public.create_review(%L, 5)', tests.id('v_jonas')), 'P0001', 'CODE_NICHT_GEFUNDEN', 'Fremder Code');
select throws_ok(format('select public.create_review(%L, 5)', tests.id('v_mia_aktiv')), 'P0001', 'BEWERTUNG_NICHT_MOEGLICH', 'Noch nicht eingelöst');

select is(
  (select rating::int from public.create_review(tests.id('v_mia'), 5, '  Super Abend, gerne wieder!  ')),
  5, 'Mit eingelöstem Code bewerten'
);
select is(
  (select comment from public.reviews where voucher_id = tests.id('v_mia')),
  'Super Abend, gerne wieder!', 'Text wird getrimmt'
);
select throws_ok(format('select public.create_review(%L, 4)', tests.id('v_mia_b')), 'P0001', 'BEREITS_BEWERTET', 'Pro Ort nur einmal, auch mit anderem Code');
select throws_ok(format('select public.create_review(%L, 4)', tests.id('v_mia')), 'P0001', 'BEREITS_BEWERTET', 'Gleichen Code nicht doppelt');

select tests.authenticate_as(tests.id('jonas'));
select is(
  (select comment from public.create_review(tests.id('v_jonas'), 3, '   ')),
  null, 'Leerer Text wird zu null'
);
select lives_ok(format('select public.create_review(%L, 1)', tests.id('v_jonas_p')), 'Auch nicht freigeschaltete Standorte lassen sich bewerten (Code wurde ja eingelöst)');

-- ---------------------------------------------------------------------------
-- RLS: direkt lesen
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.reviews), 2, 'Nutzer sieht nur eigene Bewertungen');
select throws_ok(
  format('insert into public.reviews (location_id, user_id, voucher_id, rating) values (%L, %L, %L, 5)', tests.id('loc2'), tests.id('jonas'), tests.id('v_jonas')),
  '42501', null, 'Direkt schreiben ist nicht erlaubt'
);

select tests.clear_authentication();
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.authenticate_as(tests.id('loc_user'));
select is((select count(*)::int from public.reviews), 2, 'Standort sieht die Bewertungen seines Ortes');

select tests.authenticate_as_anon();
select throws_ok('select count(*) from public.reviews', '42501', null, 'Ohne Login keine Tabelle');

-- ---------------------------------------------------------------------------
-- list_location_reviews und get_location_ratings (auch ohne Login)
-- ---------------------------------------------------------------------------
select results_eq(
  format('select author_name, rating::int, offer_title from public.list_location_reviews(%L) order by rating desc', tests.id('loc')),
  $$ values ('Mia A.', 5, 'TEST AUTOTEST Angebot'), ('Jonas A.', 3, 'TEST AUTOTEST Angebot') $$,
  'Liste: Vorname + Initial, Sterne, Angebot'
);
select is(
  (select count(*)::int from public.list_location_reviews(tests.id('loc_pending'))),
  0, 'Nicht freigeschalteter Standort: keine öffentliche Liste'
);
select is(
  (select count(*)::int from public.list_location_reviews(tests.id('loc'), 1)),
  1, 'Seitenweise'
);
select results_eq(
  format('select review_count, average_rating from public.get_location_ratings(array[%L, %L]::uuid[])', tests.id('loc'), tests.id('loc2')),
  $$ values (2, 4.0::numeric) $$,
  'Durchschnitt und Anzahl; Orte ohne Bewertung fehlen'
);

-- ---------------------------------------------------------------------------
-- set_review_hidden
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select tests.set_id('r_jonas', (select id from public.reviews where voucher_id = tests.id('v_jonas')));

select tests.authenticate_as(tests.id('mia'));
select throws_ok(format('select public.set_review_hidden(%L, true)', tests.id('r_jonas')), 'P0001', 'KEIN_ZUGRIFF', 'Nur Admin blendet aus');

select tests.authenticate_as(tests.id('admin'));
select throws_ok(format('select public.set_review_hidden(%L, true)', gen_random_uuid()), 'P0001', 'BEWERTUNG_NICHT_GEFUNDEN', 'Unbekannte Bewertung');
select isnt(
  (select hidden_at from public.set_review_hidden(tests.id('r_jonas'), true, 'Beleidigend')),
  null, 'Admin blendet aus'
);

select tests.authenticate_as_anon();
select is(
  (select count(*)::int from public.list_location_reviews(tests.id('loc'))),
  1, 'Ausgeblendete fehlen in der Liste'
);
select is(
  (select average_rating from public.get_location_ratings(array[tests.id('loc')])),
  5.0::numeric, 'und im Durchschnitt'
);

select tests.authenticate_as(tests.id('admin'));
select is(
  (select hidden_at from public.set_review_hidden(tests.id('r_jonas'), false)),
  null, 'Admin blendet wieder ein'
);

-- ---------------------------------------------------------------------------
-- Kontolöschung nimmt die Bewertungen mit
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('mia'));
select lives_ok('select public.delete_my_account()', 'Mia löscht ihr Konto');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.reviews where location_id = tests.id('loc')),
  1, 'Ihre Bewertung ist weg, die von Jonas bleibt'
);

select * from finish();
