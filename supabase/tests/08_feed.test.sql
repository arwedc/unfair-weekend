-- list_offers, get_offer, log_offer_view
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('loc2', tests.create_location('approved'));
select tests.set_id('pending', tests.create_location('pending'));
select tests.set_id('mia', tests.create_nutzer('Mia'));

-- Sortierung: Einzeltermin nach Beginn, Zeitraum nach Ende
select tests.set_id('e_morgen', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '1 day', now() + interval '1 day 2 hours'));
select tests.set_id('z_ende_2', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '3 days', now() + interval '2 days'));
select tests.set_id('e_in_3', tests.create_offer(tests.id('loc2'), 'einzeltermin', now() + interval '3 days', now() + interval '3 days 2 hours'));
select tests.set_id('z_ende_12h', tests.create_offer(tests.id('loc2'), 'zeitraum', now() - interval '1 day', now() + interval '12 hours'));
update public.locations set image_paths = array['standort/hauptbild.jpg', 'standort/zweites-bild.jpg']
where id = tests.id('loc');
update public.offers set category = 'sport_bewegung' where id = tests.id('e_in_3');

-- Nicht im Feed
select tests.set_id('begonnen', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '1 minute', now() + interval '1 hour'));
select tests.set_id('z_vorbei', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '3 days', now() - interval '1 minute'));
select tests.set_id('abgesagt', tests.create_offer(tests.id('loc')));
update public.offers set status = 'abgesagt' where id = tests.id('abgesagt');
select tests.set_id('pending_offer', tests.create_offer(tests.id('pending')));

-- Ausgebucht: im Feed mit 0 Plätzen, außer bei only_available
select tests.set_id('voll', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '5 days', now() + interval '5 days 1 hour', 1, 1));
select tests.set_id('v_voll', tests.create_voucher(tests.id('voll'), tests.id('mia')));

create function pg_temp.feed_ids(p_category public.offer_category default null, p_locations uuid[] default null, p_only boolean default false)
returns uuid[] language sql as $$
  select coalesce(array_agg(f.id order by f.relevant_at, f.id), '{}')
  from public.list_offers(p_category, p_locations, p_only, 100, 0) f
  where f.id in (select v from tests.ids);
$$;
grant execute on function pg_temp.feed_ids(public.offer_category, uuid[], boolean) to anon, authenticated;

select tests.authenticate_as_anon();
select is(
  pg_temp.feed_ids(),
  array[tests.id('z_ende_12h'), tests.id('e_morgen'), tests.id('z_ende_2'), tests.id('e_in_3'), tests.id('voll')],
  'Feed: nur holbare Angebote, sortiert nach „als Nächstes relevant“'
);
select is(
  (select array_agg(id order by relevant_at, id) from public.list_offers() where id in (select v from tests.ids)),
  pg_temp.feed_ids(), 'list_offers liefert bereits in dieser Reihenfolge'
);
select is(pg_temp.feed_ids('sport_bewegung'), array[tests.id('e_in_3')], 'Filter Kategorie');
select is(
  pg_temp.feed_ids(null, array[tests.id('loc2')]),
  array[tests.id('z_ende_12h'), tests.id('e_in_3')], 'Filter Standort'
);
select ok(not (tests.id('voll') = any (pg_temp.feed_ids(null, null, true))), 'only_available blendet Ausgebuchtes aus');
select is((select free_seats from public.list_offers() where id = tests.id('voll')), 0, 'Ausgebucht: 0 freie Plätze');
select is((select discount_percent from public.list_offers() where id = tests.id('e_morgen')), 40, 'Rabatt in Prozent (abgerundet)');
select is((select cover_image_path from public.list_offers() where id = tests.id('e_morgen')), 'standort/hauptbild.jpg', 'Hauptbild kommt vom Standort');
select is((select location_name from public.list_offers() where id = tests.id('e_morgen')), 'TEST AUTOTEST Standort', 'Standortinfo');
select is((select count(*)::int from public.list_offers(null, null, false, 1, 0)), 1, 'Limit');
select ok((select count(*) from public.list_offers(null, null, false, 100000, 0)) <= 100, 'Limit höchstens 100');

-- get_offer
select is((select is_claimable from public.get_offer(tests.id('e_morgen'))), true, 'get_offer: holbar');
select is((select is_claimable from public.get_offer(tests.id('begonnen'))), false, 'get_offer: begonnenes Angebot sichtbar, nicht holbar');
select is((select count(*)::int from public.get_offer(tests.id('abgesagt'))), 0, 'get_offer: abgesagt für anon unsichtbar');
select is((select count(*)::int from public.get_offer(tests.id('pending_offer'))), 0, 'get_offer: nicht freigeschalteter Standort unsichtbar');

select tests.authenticate_as(tests.id('loc_user'));
select is((select status::text from public.get_offer(tests.id('abgesagt'))), 'abgesagt', 'get_offer: eigener Standort sieht Abgesagtes');

select tests.clear_authentication();
select tests.set_id('v_abgesagt', tests.create_voucher(tests.id('abgesagt'), tests.id('mia'), 1, 'storniert'));
select tests.authenticate_as(tests.id('mia'));
select is((select count(*)::int from public.get_offer(tests.id('abgesagt'))), 1, 'get_offer: Code-Inhaber sieht Abgesagtes');

-- log_offer_view
select tests.authenticate_as_anon();
select lives_ok(format('select public.log_offer_view(%L)', tests.id('e_morgen')), 'anon zählt Aufruf');
select lives_ok(format('select public.log_offer_view(%L)', gen_random_uuid()), 'unbekanntes Angebot: kein Fehler');
select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.log_offer_view(%L)', tests.id('e_morgen')), 'Nutzer zählt Aufruf');
select lives_ok(format('select public.log_offer_view(%L)', tests.id('e_morgen')), 'zweiter Aufruf innerhalb 30 Min.');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where type = 'angebot_angesehen' and offer_id = tests.id('e_morgen')),
  2, 'anon 1× + Nutzer 1× (Doppelaufruf zählt nicht)'
);

select * from finish();
