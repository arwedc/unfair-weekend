-- create_offer, update_offer, cancel_offer, remove_offer
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('fremd_user', tests.location_user(tests.create_location('approved')));
select tests.set_id('admin', tests.create_admin());
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));

-- Gültige Standardwerte; jede Prüfung ändert genau einen Parameter
create function pg_temp.create_sql(
  p_title text default 'TEST AUTOTEST Kochkurs',
  p_description text default 'Ein ausführlicher Kochkurs mit allem drum und dran.',
  p_images text default 'array[''loc/a.jpg'']',
  p_original integer default 4000,
  p_deal integer default 3000,
  p_capacity integer default 10,
  p_max integer default 2,
  p_address text default 'Prinzipalmarkt 1, 48143 Münster',
  p_lat text default '51.96',
  p_type text default 'einzeltermin',
  p_start text default 'now() + interval ''1 day''',
  p_end text default 'now() + interval ''1 day 3 hours'''
) returns text language sql as $$
  select format(
    'select public.create_offer(%L, %L, %L, %s, %s, %s, %s, %s, %L, %s, 7.62, %L, %s, %s)',
    p_title, p_description, 'kochen_essen', p_images, p_original, p_deal, p_capacity, p_max,
    p_address, p_lat, p_type, p_start, p_end
  );
$$;
grant execute on function pg_temp.create_sql(text, text, text, integer, integer, integer, integer, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_offer
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(pg_temp.create_sql(), 'gültiges Angebot');
select throws_ok(pg_temp.create_sql(p_title => 'ab'), 'P0001', 'UNGUELTIGE_EINGABE', 'Titel zu kurz');
select throws_ok(pg_temp.create_sql(p_description => 'zu kurz'), 'P0001', 'UNGUELTIGE_EINGABE', 'Beschreibung zu kurz');
select lives_ok(pg_temp.create_sql(p_title => 'TEST AUTOTEST Ohne Bild', p_images => 'array[]::text[]'), 'ohne Bild erlaubt');
select lives_ok(pg_temp.create_sql(p_title => 'TEST AUTOTEST Bild NULL', p_images => 'null'), 'NULL zählt als kein Bild');
select is(
  (select array_agg(cardinality(image_paths)) from public.offers where title in ('TEST AUTOTEST Ohne Bild', 'TEST AUTOTEST Bild NULL')),
  array[0, 0],
  'ohne Bild gespeichert als leeres Array'
);
select lives_ok(pg_temp.create_sql(p_title => 'TEST AUTOTEST Getrimmt', p_images => 'array['' a.jpg '', ''b.jpg'']'), 'Bildpfade mit Leerzeichen');
select is(
  (select image_paths from public.offers where title = 'TEST AUTOTEST Getrimmt'),
  '{}'::text[],
  'Einzelne Angebotsbilder werden nicht mehr gespeichert'
);
select throws_ok(pg_temp.create_sql(p_images => 'array[''1'',''2'',''3'',''4'',''5'',''6'']'), 'P0001', 'BILDER_UNGUELTIG', '6 Bilder');
select throws_ok(pg_temp.create_sql(p_images => 'array[''a.jpg'', null]'), 'P0001', 'BILDER_UNGUELTIG', 'leerer Bildeintrag');
select throws_ok(pg_temp.create_sql(p_deal => 4000), 'P0001', 'PREIS_UNGUELTIG', 'Deal = Original');
select throws_ok(pg_temp.create_sql(p_deal => 3201), 'P0001', 'RABATT_ZU_GERING', '19,9 % Rabatt bei 20 % Minimum');
select lives_ok(pg_temp.create_sql(p_deal => 3200), 'genau 20 % Rabatt');
select throws_ok(pg_temp.create_sql(p_capacity => 0), 'P0001', 'UNGUELTIGE_EINGABE', 'Kontingent 0');
select throws_ok(pg_temp.create_sql(p_max => 11), 'P0001', 'UNGUELTIGE_EINGABE', 'max pro Person > Kontingent');
select throws_ok(pg_temp.create_sql(p_address => 'abc'), 'P0001', 'ADRESSE_UNGUELTIG', 'Adresse zu kurz');
select throws_ok(pg_temp.create_sql(p_lat => 'null'), 'P0001', 'ADRESSE_UNGUELTIG', 'Koordinaten fehlen');
select throws_ok(pg_temp.create_sql(p_end => 'now() + interval ''20 hours'''), 'P0001', 'ZEIT_UNGUELTIG', 'Ende vor Beginn');
select throws_ok(pg_temp.create_sql(p_end => 'now() + interval ''100 days'''), 'P0001', 'ZEIT_UNGUELTIG', 'länger als 90 Tage');
select throws_ok(pg_temp.create_sql(p_start => 'now() - interval ''1 hour'''), 'P0001', 'ZEIT_IN_VERGANGENHEIT', 'Einzeltermin in der Vergangenheit');
select lives_ok(
  pg_temp.create_sql(p_type => 'zeitraum', p_start => 'now() - interval ''1 hour'''),
  'Zeitraum darf schon begonnen haben'
);

-- Mindestrabatt folgt der Einstellung
select tests.clear_authentication();
update public.settings set min_discount_percent = 40;
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(pg_temp.create_sql(p_deal => 2500), 'P0001', 'RABATT_ZU_GERING', 'Mindestrabatt 40 %');
select tests.clear_authentication();
update public.settings set min_discount_percent = 20;

-- ---------------------------------------------------------------------------
-- update_offer
-- ---------------------------------------------------------------------------
select tests.set_id('offer', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '2 days', now() + interval '2 days 3 hours', 10, 2));

create function pg_temp.update_sql(
  p_title text default 'TEST AUTOTEST Geändert',
  p_images text default 'array[''neu/1.jpg'', ''neu/2.jpg'']',
  p_original integer default 4000,
  p_deal integer default 2400,
  p_capacity integer default 10,
  p_category text default 'kochen_essen',
  p_address text default 'Prinzipalmarkt 1, 48143 Münster',
  p_start text default null
) returns text language sql as $$
  select format(
    'select public.update_offer(%L, %L, %L, %L, %s, %s, %s, %s, 2, %L, 51.9625, 7.628, ''einzeltermin'', %s, %L)',
    tests.id('offer'), p_title, 'Automatisch erzeugtes Testangebot.', p_category, p_images, p_original, p_deal,
    p_capacity, p_address,
    coalesce(p_start, quote_literal((select starts_at from public.offers where id = tests.id('offer')))),
    (select ends_at from public.offers where id = tests.id('offer'))
  );
$$;
grant execute on function pg_temp.update_sql(text, text, integer, integer, integer, text, text, text) to authenticated;
-- update_sql liest offers: als Standort sichtbar (eigenes Angebot)

select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000), 'ohne Codes: Preise änderbar');

select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.claim_voucher(%L, 2)', tests.id('offer')), 'Mia holt 2 Plätze');
select tests.authenticate_as(tests.id('jonas'));
select lives_ok(format('select public.claim_voucher(%L, 2)', tests.id('offer')), 'Jonas holt 2 Plätze');

select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000, p_title => 'TEST AUTOTEST Neuer Titel', p_category => 'sonstiges'), 'mit Codes: Titel, Bilder, Kategorie änderbar');
select throws_ok(pg_temp.update_sql(p_original => 5000, p_deal => 2900), 'P0001', 'FELD_GESPERRT', 'mit Codes: Preis gesperrt');
select throws_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000, p_address => 'Ludgeristraße 1, Münster'), 'P0001', 'FELD_GESPERRT', 'mit Codes: Adresse gesperrt');
select throws_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000, p_start => 'now() + interval ''2 days 1 hour'''), 'P0001', 'FELD_GESPERRT', 'mit Codes: Zeit gesperrt');
select lives_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000, p_capacity => 20), 'Kontingent erhöhen');
select lives_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000, p_images => 'array[]::text[]'), 'mit Codes: alle Bilder entfernbar');
select lives_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000, p_capacity => 4), 'Kontingent auf vergebene Plätze senken');
select throws_ok(pg_temp.update_sql(p_original => 5000, p_deal => 3000, p_capacity => 3), 'P0001', 'KONTINGENT_ZU_KLEIN', 'Kontingent unter vergebene Plätze');

select tests.authenticate_as(tests.id('fremd_user'));
select throws_ok(
  format('select public.update_offer(%L, ''x x x'', ''beschreibung lang genug'', ''sonstiges'', array[''a''], 5000, 3000, 10, 2, ''Prinzipalmarkt 1'', 51.96, 7.62, ''einzeltermin'', now() + interval ''2 days'', now() + interval ''2 days 3 hours'')', tests.id('offer')),
  'P0001', 'ANGEBOT_NICHT_GEFUNDEN', 'fremdes Angebot nicht änderbar'
);

-- Wenn alle Codes storniert sind, sind Preise wieder änderbar
select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.cancel_voucher((select id from public.vouchers where offer_id = %L and status = ''aktiv''))', tests.id('offer')), 'Mia storniert');
select tests.authenticate_as(tests.id('jonas'));
select lives_ok(format('select public.cancel_voucher((select id from public.vouchers where offer_id = %L and status = ''aktiv''))', tests.id('offer')), 'Jonas storniert');
select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(pg_temp.update_sql(p_original => 5000, p_deal => 2000, p_capacity => 4), 'alle Codes storniert: Preise wieder frei');

-- ---------------------------------------------------------------------------
-- cancel_offer
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select tests.set_id('abzusagen', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '10 minutes', now() + interval '2 hours'));
select tests.set_id('v1', tests.create_voucher(tests.id('abzusagen'), tests.id('mia'), 2));
select tests.set_id('v2', tests.create_voucher(tests.id('abzusagen'), tests.id('jonas'), 1));
select tests.set_id('v3', tests.create_voucher(tests.id('abzusagen'), tests.create_nutzer('Lea'), 1, 'storniert'));
select tests.set_id('v4', tests.create_voucher(tests.id('abzusagen'), tests.create_nutzer('Tom'), 1, 'eingeloest'));

select tests.authenticate_as(tests.id('fremd_user'));
select throws_ok(format('select public.cancel_offer(%L)', tests.id('abzusagen')), 'P0001', 'ANGEBOT_NICHT_GEFUNDEN', 'fremdes Angebot nicht absagbar');

select tests.authenticate_as(tests.id('loc_user'));
select is(
  (public.cancel_offer(tests.id('abzusagen'), 'Krankheit') ->> 'cancelled_vouchers')::int,
  2, 'jederzeit absagbar (auch nach Beginn): 2 aktive Codes storniert'
);
select throws_ok(format('select public.cancel_offer(%L)', tests.id('abzusagen')), 'P0001', 'ANGEBOT_NICHT_AKTIV', 'nicht doppelt absagen');

select tests.clear_authentication();
select is((select status::text from public.offers where id = tests.id('abzusagen')), 'abgesagt', 'Status abgesagt');
select is((select status_reason from public.offers where id = tests.id('abzusagen')), 'Krankheit', 'Begründung gespeichert');
select is(
  (select count(*)::int from public.vouchers where offer_id = tests.id('abzusagen') and status = 'no_show'),
  0, 'keine No-Shows durch Absage'
);
select is(
  (select array_agg(status::text order by id) from public.vouchers where id in (tests.id('v1'), tests.id('v2'))),
  array['storniert', 'storniert'], 'aktive Codes storniert'
);
select is((select cancel_reason::text from public.vouchers where id = tests.id('v1')), 'angebot_abgesagt', 'Grund angebot_abgesagt');
select is((select status::text from public.vouchers where id = tests.id('v4')), 'eingeloest', 'eingelöste Codes bleiben unverändert');
select is(
  (select count(*)::int from public.notification_outbox where offer_id = tests.id('abzusagen') and type = 'angebot_abgesagt'),
  2, 'je betroffenem Inhaber ein Outbox-Eintrag'
);
select is(
  (select payload ->> 'message' from public.notification_outbox where voucher_id = tests.id('v1')),
  'Krankheit', 'Outbox-Payload enthält die Begründung'
);
select is((select seats_taken from public.offers where id = tests.id('abzusagen')), 1, 'nur der eingelöste Platz bleibt belegt');

-- ---------------------------------------------------------------------------
-- remove_offer (Admin)
-- ---------------------------------------------------------------------------
select tests.set_id('zu_entfernen', tests.create_offer(tests.id('loc')));
select tests.set_id('v5', tests.create_voucher(tests.id('zu_entfernen'), tests.id('mia')));
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(format('select public.remove_offer(%L)', tests.id('zu_entfernen')), 'P0001', 'KEIN_ZUGRIFF', 'nur Admins entfernen');
select tests.authenticate_as(tests.id('admin'));
select is((public.remove_offer(tests.id('zu_entfernen'), 'Verstoß') ->> 'cancelled_vouchers')::int, 1, 'Admin entfernt, Code storniert');
select throws_ok(format('select public.remove_offer(%L)', tests.id('zu_entfernen')), 'P0001', 'ANGEBOT_NICHT_AKTIV', 'nicht doppelt entfernen');
select tests.clear_authentication();
select is((select status::text from public.offers where id = tests.id('zu_entfernen')), 'entfernt', 'Status entfernt');
select is((select cancel_reason::text from public.vouchers where id = tests.id('v5')), 'angebot_entfernt', 'Grund angebot_entfernt');
select is((select count(*)::int from public.notification_outbox where voucher_id = tests.id('v5')), 1, 'Inhaber wird benachrichtigt');

select * from finish();
