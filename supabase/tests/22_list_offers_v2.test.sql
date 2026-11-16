-- list_offers_v2: Feed mit created_at und Standortbewertung in einer Anfrage
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc2', tests.create_location('approved'));
select tests.set_id('pending', tests.create_location('pending'));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));
select tests.set_id('lea', tests.create_nutzer('Lea'));

select tests.set_id('a', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '1 day', now() + interval '1 day 2 hours'));
select tests.set_id('b', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '2 days', now() + interval '2 days 2 hours'));
select tests.set_id('c', tests.create_offer(tests.id('loc2'), 'einzeltermin', now() + interval '3 days', now() + interval '3 days 2 hours'));
select tests.set_id('begonnen', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '1 minute', now() + interval '1 hour'));
select tests.set_id('pending_offer', tests.create_offer(tests.id('pending')));
select tests.set_id('alt', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '9 days', now() - interval '8 days'));
update public.offers set created_at = now() - interval '6 days' where id = tests.id('a');

-- Bewertungen: loc hat 5 und 2 sichtbar (Schnitt 3.5) und eine ausgeblendete, loc2 keine
insert into public.reviews (location_id, user_id, voucher_id, rating)
values
  (tests.id('loc'), tests.id('mia'), tests.create_voucher(tests.id('alt'), tests.id('mia'), 1, 'eingeloest'), 5),
  (tests.id('loc'), tests.id('jonas'), tests.create_voucher(tests.id('alt'), tests.id('jonas'), 1, 'eingeloest'), 2),
  (tests.id('loc'), tests.id('lea'), tests.create_voucher(tests.id('alt'), tests.id('lea'), 1, 'eingeloest'), 1);
update public.reviews set hidden_at = now(), hidden_reason = 'intern' where user_id = tests.id('lea');

select tests.authenticate_as_anon();

select is(
  (select array_agg(f.id) from public.list_offers_v2(null, null, false, 100, 0) f where f.id in (select v from tests.ids)),
  array[tests.id('a'), tests.id('b'), tests.id('c')],
  'v2: nur holbare Angebote, sortiert nach „als Nächstes relevant“, auch ohne Login'
);
select is(
  (select array_agg(f.id) from public.list_offers_v2(null, null, false, 100, 0) f where f.id in (select v from tests.ids)),
  (select array_agg(f.id) from public.list_offers(null, null, false, 100, 0) f where f.id in (select v from tests.ids)),
  'v2: gleiche Angebote und Reihenfolge wie list_offers'
);
select is(
  (select created_at from public.list_offers_v2() where id = tests.id('a')),
  (select created_at from public.list_offer_created_at(array[tests.id('a')])),
  'v2: created_at wie list_offer_created_at'
);
select is((select location_review_count from public.list_offers_v2() where id = tests.id('a')), 2, 'v2: Anzahl ohne ausgeblendete Bewertungen');
select is((select location_average_rating from public.list_offers_v2() where id = tests.id('b')), 3.5, 'v2: Schnitt auf eine Nachkommastelle, pro Standort gleich');
select is((select location_review_count from public.list_offers_v2() where id = tests.id('c')), 0, 'v2: ohne Bewertungen Anzahl 0');
select is((select location_average_rating from public.list_offers_v2() where id = tests.id('c')), null, 'v2: ohne Bewertungen Schnitt null');
select is(
  (select array_agg(f.id) from public.list_offers_v2(null, array[tests.id('loc2')]) f where f.id in (select v from tests.ids)),
  array[tests.id('c')], 'v2: Filter Standort'
);
select is((select count(*)::int from public.list_offers_v2(null, null, false, 1, 0)), 1, 'v2: Limit');
select ok((select count(*) from public.list_offers_v2(null, null, false, 100000, 0)) <= 100, 'v2: Limit höchstens 100');

select * from finish();
