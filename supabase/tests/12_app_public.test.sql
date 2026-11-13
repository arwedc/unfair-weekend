-- get_locations_public, list_offer_created_at (öffentliche Daten für die App)
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc2', tests.create_location('approved'));
select tests.set_id('pending', tests.create_location('pending'));
select tests.set_id('rejected', tests.create_location('rejected'));
select tests.set_id('mia', tests.create_nutzer('Mia'));

update public.locations
set name = 'TEST AUTOTEST A-Standort', phone = '0251 123456', website = 'https://example.com'
where id = tests.id('loc');
update public.locations set name = 'TEST AUTOTEST B-Standort' where id = tests.id('loc2');
update public.companies
set description = 'TEST AUTOTEST Beschreibung', logo_path = 'test/logo.png'
where id = (select company_id from public.locations where id = tests.id('loc'));
select tests.set_id('loc_company', (select company_id from public.locations where id = tests.id('loc')));

-- Angebote: zwei holbare (unterschiedlich alt), eines begonnen, eines abgesagt, eines bei pending
select tests.set_id('alt', tests.create_offer(tests.id('loc')));
select tests.set_id('neu', tests.create_offer(tests.id('loc2')));
update public.offers set created_at = now() - interval '5 days' where id = tests.id('alt');
update public.offers set created_at = now() - interval '1 hour' where id = tests.id('neu');
select tests.set_id('begonnen', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '1 minute', now() + interval '1 hour'));
select tests.set_id('abgesagt', tests.create_offer(tests.id('loc')));
update public.offers set status = 'abgesagt' where id = tests.id('abgesagt');
select tests.set_id('pending_offer', tests.create_offer(tests.id('pending')));

-- ---------------------------------------------------------------------------
-- get_locations_public
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select is(
  (select array_agg(id order by name, id) from public.get_locations_public(
    array[tests.id('loc2'), tests.id('loc'), tests.id('pending'), tests.id('rejected'), gen_random_uuid()]
  )),
  array[tests.id('loc'), tests.id('loc2')],
  'anon: nur freigeschaltete Standorte, sortiert nach Name'
);
select is(
  (select row(name, street, postal_code, city, phone, website)::text from public.get_locations_public(array[tests.id('loc')])),
  row('TEST AUTOTEST A-Standort', 'Prinzipalmarkt 1', '48143', 'Münster', '0251 123456', 'https://example.com')::text,
  'Standortdaten'
);
select is(
  (select row(company_name, company_description, company_logo_path)::text from public.get_locations_public(array[tests.id('loc')])),
  row('TEST AUTOTEST Firma', 'TEST AUTOTEST Beschreibung', 'test/logo.png')::text,
  'Unternehmensinfo'
);
select is(
  (select company_id from public.get_locations_public(array[tests.id('loc')])),
  tests.id('loc_company'),
  'company_id'
);
select is(
  (select lat from public.get_locations_public(array[tests.id('loc')])), 51.9625::double precision,
  'Koordinaten'
);
select is((select count(*)::int from public.get_locations_public(array[tests.id('pending')])), 0, 'pending bleibt unsichtbar');
select is((select count(*)::int from public.get_locations_public(array[tests.id('rejected')])), 0, 'rejected bleibt unsichtbar');
select is((select count(*)::int from public.get_locations_public(null)), 0, 'null liefert nichts');
select is((select count(*)::int from public.get_locations_public('{}')), 0, 'leere Liste liefert nichts');

select tests.authenticate_as(tests.id('mia'));
select is(
  (select count(*)::int from public.get_locations_public(array[tests.id('loc'), tests.id('loc2'), tests.id('pending')])),
  2, 'Nutzer: gleiche Sicht wie anon'
);
select is((select count(*)::int from public.locations), 0, 'RLS: Nutzer sieht die Tabelle locations nicht direkt');

-- Höchstens 100 IDs pro Aufruf: die freigeschaltete ID an Position 101 fällt weg
select tests.authenticate_as_anon();
select is(
  (select count(*)::int from public.get_locations_public(
    (select array_agg(gen_random_uuid()) from generate_series(1, 100)) || tests.id('loc')
  )),
  0, 'IDs ab Position 101 werden ignoriert'
);

-- ---------------------------------------------------------------------------
-- list_offer_created_at
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(id order by created_at desc, id) from public.list_offer_created_at(
    array[tests.id('alt'), tests.id('neu'), tests.id('begonnen'), tests.id('abgesagt'), tests.id('pending_offer'), gen_random_uuid()]
  )),
  array[tests.id('neu'), tests.id('alt')],
  'anon: nur holbare Angebote, neueste zuerst'
);
select ok(
  (select created_at from public.list_offer_created_at(array[tests.id('alt')])) < now() - interval '4 days',
  'created_at wird geliefert'
);
select is(
  (select array_agg(c.id order by c.id) from public.list_offer_created_at(
    array[tests.id('alt'), tests.id('neu'), tests.id('begonnen'), tests.id('abgesagt'), tests.id('pending_offer')]
  ) c),
  (select array_agg(f.id order by f.id) from public.list_offers(
    p_location_ids => array[tests.id('loc'), tests.id('loc2'), tests.id('pending')]
  ) f),
  'gleiche Sichtbarkeit wie list_offers'
);
select is((select count(*)::int from public.list_offer_created_at(null)), 0, 'null liefert nichts');

select tests.authenticate_as(tests.id('mia'));
select is(
  (select count(*)::int from public.list_offer_created_at(array[tests.id('alt'), tests.id('neu'), tests.id('abgesagt')])),
  2, 'Nutzer: gleiche Sicht wie anon'
);

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select ok(has_function_privilege('anon', 'public.get_locations_public(uuid[])', 'execute'), 'anon darf get_locations_public');
select ok(has_function_privilege('authenticated', 'public.get_locations_public(uuid[])', 'execute'), 'authenticated darf get_locations_public');
select ok(has_function_privilege('anon', 'public.list_offer_created_at(uuid[])', 'execute'), 'anon darf list_offer_created_at');
select ok(has_function_privilege('authenticated', 'public.list_offer_created_at(uuid[])', 'execute'), 'authenticated darf list_offer_created_at');

select * from finish();
