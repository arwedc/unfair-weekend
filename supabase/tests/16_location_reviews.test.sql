-- Bewertungen für den eigenen Standort: list_my_reviews, get_my_review_summary
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('loc2', tests.create_location('approved'));
select tests.set_id('loc2_user', tests.location_user(tests.id('loc2')));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));
select tests.set_id('lea', tests.create_nutzer('Lea'));

select tests.set_id('offer', tests.create_offer(tests.id('loc')));
select tests.set_id('offer2', tests.create_offer(tests.id('loc2')));

-- Bewertungen direkt anlegen (die Regeln von create_review testet 14_reviews)
insert into public.reviews (location_id, user_id, voucher_id, rating, comment, created_at)
values
  (tests.id('loc'), tests.id('mia'), tests.create_voucher(tests.id('offer'), tests.id('mia'), 1, 'eingeloest'), 5, 'Super Abend!', now() - interval '2 days'),
  (tests.id('loc'), tests.id('jonas'), tests.create_voucher(tests.id('offer'), tests.id('jonas'), 1, 'eingeloest'), 2, null, now() - interval '40 days'),
  (tests.id('loc'), tests.id('lea'), tests.create_voucher(tests.id('offer'), tests.id('lea'), 1, 'eingeloest'), 1, 'Beleidigung', now() - interval '1 day'),
  (tests.id('loc2'), tests.id('mia'), tests.create_voucher(tests.id('offer2'), tests.id('mia'), 1, 'eingeloest'), 4, 'Anderer Ort', now());
update public.reviews set hidden_at = now(), hidden_reason = 'intern' where user_id = tests.id('lea');

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok('select * from public.list_my_reviews()', '42501', null, 'Ohne Login: keine Ausführungsrechte (Liste)');
select throws_ok('select * from public.get_my_review_summary()', '42501', null, 'Ohne Login: keine Ausführungsrechte (Übersicht)');

select tests.authenticate_as(tests.id('mia'));
select throws_ok('select * from public.list_my_reviews()', 'P0001', 'KEIN_STANDORTKONTO', 'Nutzer ohne Standort: Liste');
select throws_ok('select * from public.get_my_review_summary()', 'P0001', 'KEIN_STANDORTKONTO', 'Nutzer ohne Standort: Übersicht');

-- ---------------------------------------------------------------------------
-- list_my_reviews
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('loc_user'));
select results_eq(
  'select author_name, rating::int, comment, offer_title, is_hidden from public.list_my_reviews()',
  $$ values
    ('Lea A.', 1, 'Beleidigung', 'TEST AUTOTEST Angebot', true),
    ('Mia A.', 5, 'Super Abend!', 'TEST AUTOTEST Angebot', false),
    ('Jonas A.', 2, null::text, 'TEST AUTOTEST Angebot', false) $$,
  'Nur eigener Standort, neueste zuerst, ausgeblendete markiert'
);
select is(
  (select offer_id from public.list_my_reviews() limit 1),
  tests.id('offer'), 'Angebot-ID kommt mit'
);
select results_eq(
  'select author_name from public.list_my_reviews(5)',
  $$ values ('Mia A.') $$,
  'Filter nach Sternen'
);
select is((select count(*)::int from public.list_my_reviews(null, 1)), 1, 'Seitenweise: Limit');
select is(
  (select author_name from public.list_my_reviews(null, 1, 2)),
  'Jonas A.', 'Seitenweise: Offset'
);
select is((select count(*)::int from public.list_my_reviews(null, 500)), 3, 'Limit wird auf 50 gedeckelt');
select throws_ok('select * from public.list_my_reviews(6)', 'P0001', 'UNGUELTIGE_EINGABE', 'Filter 6 Sterne geht nicht');
select throws_ok('select * from public.list_my_reviews(0)', 'P0001', 'UNGUELTIGE_EINGABE', 'Filter 0 Sterne geht nicht');

-- ---------------------------------------------------------------------------
-- get_my_review_summary
-- ---------------------------------------------------------------------------
select results_eq(
  'select review_count, average_rating, rating_1, rating_2, rating_3, rating_4, rating_5, hidden_count, last_30_days from public.get_my_review_summary()',
  $$ values (2, 3.5::numeric, 0, 1, 0, 0, 1, 1, 1) $$,
  'Übersicht: nur sichtbare zählen, ausgeblendete separat, letzte 30 Tage'
);

-- Standort ohne Bewertungen: genau eine Zeile mit Nullen
select tests.clear_authentication();
select tests.set_id('loc3_user', tests.location_user(tests.create_location('pending')));
select tests.authenticate_as(tests.id('loc3_user'));
select results_eq(
  'select review_count, average_rating, hidden_count from public.get_my_review_summary()',
  $$ values (0, null::numeric, 0) $$,
  'Ohne Bewertungen: 0 und kein Durchschnitt (auch nicht freigeschaltet)'
);
select is((select count(*)::int from public.list_my_reviews()), 0, 'Ohne Bewertungen: leere Liste');

select * from finish();
