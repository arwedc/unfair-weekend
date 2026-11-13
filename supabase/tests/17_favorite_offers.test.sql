-- Lieblingsangebote: nur eigene Zeilen lesen, anlegen, löschen; Kontolöschung räumt auf
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('offer', tests.create_offer(tests.id('loc')));
select tests.set_id('offer2', tests.create_offer(tests.id('loc')));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));

select tests.authenticate_as(tests.id('mia'));
select lives_ok(
  format('insert into public.favorite_offers (user_id, offer_id) values (%L, %L)', tests.id('mia'), tests.id('offer')),
  'Nutzer merkt sich ein Angebot'
);
select lives_ok(
  format('insert into public.favorite_offers (user_id, offer_id) values (%L, %L)', tests.id('mia'), tests.id('offer2')),
  'und noch eins'
);
select throws_ok(
  format('insert into public.favorite_offers (user_id, offer_id) values (%L, %L)', tests.id('mia'), tests.id('offer')),
  '23505', null, 'Doppelt merken geht nicht'
);
select throws_ok(
  format('insert into public.favorite_offers (user_id, offer_id) values (%L, %L)', tests.id('jonas'), tests.id('offer')),
  '42501', null, 'Für andere merken geht nicht'
);
select is((select count(*)::int from public.favorite_offers), 2, 'Nutzer sieht eigene');

select tests.authenticate_as(tests.id('jonas'));
select is((select count(*)::int from public.favorite_offers), 0, 'Anderer Nutzer sieht fremde nicht');
delete from public.favorite_offers where offer_id = tests.id('offer');
select tests.authenticate_as(tests.id('mia'));
select is((select count(*)::int from public.favorite_offers), 2, 'Fremde Zeilen lassen sich nicht löschen');

delete from public.favorite_offers where offer_id = tests.id('offer2');
select is((select count(*)::int from public.favorite_offers), 1, 'Eigene lassen sich löschen');

select tests.authenticate_as_anon();
select throws_ok('select count(*) from public.favorite_offers', '42501', null, 'Ohne Login keine Tabelle');

select tests.authenticate_as(tests.id('mia'));
select lives_ok('select public.delete_my_account()', 'Mia löscht ihr Konto');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.favorite_offers where user_id = tests.id('mia')),
  0, 'Kontolöschung nimmt die Favoriten mit'
);

select * from finish();
