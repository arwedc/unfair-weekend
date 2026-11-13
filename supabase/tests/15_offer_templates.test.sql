-- Angebotsvorlagen: anlegen, ändern, löschen, nur der eigene Standort, Limit und Namen
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc2', tests.create_location('approved'));
select tests.set_id('loc_pending', tests.create_location('pending'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('loc2_user', tests.location_user(tests.id('loc2')));
select tests.set_id('loc_pending_user', tests.location_user(tests.id('loc_pending')));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('admin', tests.create_admin());

-- Aufruf mit Standardwerten, einzelne Argumente lassen sich überschreiben (als SQL-Text)
create function pg_temp.create_sql(
  p_name text default 'TEST AUTOTEST Vorlage',
  p_title text default 'TEST AUTOTEST Kochkurs',
  p_images text default 'array[''test/bild-1.jpg'']',
  p_original integer default 4000,
  p_deal integer default 2400,
  p_capacity integer default 10,
  p_max_per_user integer default 2,
  p_duration text default '180'
)
returns text
language sql
as $$
  select format(
    'select public.create_offer_template(%L, %L, %L, %L, %s, %s, %s, %s, %s, %L, %s)',
    p_name, p_title, 'Automatisch erzeugte Testvorlage.', 'kochen_essen', p_images,
    p_original, p_deal, p_capacity, p_max_per_user, 'einzeltermin', p_duration
  );
$$;

create function pg_temp.update_sql(
  p_template_id uuid,
  p_name text default 'TEST AUTOTEST Vorlage',
  p_deal integer default 2000,
  p_duration text default '240'
)
returns text
language sql
as $$
  select format(
    'select public.update_offer_template(%L, %L, %L, %L, %L, %s, %s, %s, %s, %s, %L, %s)',
    p_template_id, p_name, 'TEST AUTOTEST Kochkurs neu', 'Automatisch erzeugte Testvorlage.',
    'kochen_essen', 'array[]::text[]', 4000, p_deal, 10, 2, 'zeitraum', p_duration
  );
$$;

grant execute on function pg_temp.create_sql(text, text, text, integer, integer, integer, integer, text) to anon, authenticated;
grant execute on function pg_temp.update_sql(uuid, text, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok(pg_temp.create_sql(), '42501', null, 'Ohne Login: keine Ausführungsrechte');
select is(
  tests.error_code($$ select * from public.offer_templates $$),
  'permission denied for table offer_templates', 'Ohne Login: kein Tabellenzugriff'
);

select tests.authenticate_as(tests.id('mia'));
select throws_ok(pg_temp.create_sql(), 'P0001', 'KEIN_STANDORTKONTO', 'Nutzer können keine Vorlagen anlegen');

select tests.authenticate_as(tests.id('loc_pending_user'));
select throws_ok(pg_temp.create_sql(), 'P0001', 'STANDORT_NICHT_FREIGESCHALTET', 'Nicht freigeschalteter Standort');

-- ---------------------------------------------------------------------------
-- create_offer_template
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(pg_temp.create_sql(p_name => 'x'), 'P0001', 'UNGUELTIGE_EINGABE', 'Name zu kurz');
select throws_ok(pg_temp.create_sql(p_title => 'ab'), 'P0001', 'UNGUELTIGE_EINGABE', 'Titel zu kurz');
select throws_ok(pg_temp.create_sql(p_images => 'array[''a'',''b'',''c'',''d'',''e'',''f'']'), 'P0001', 'BILDER_UNGUELTIG', '6 Bilder');
select throws_ok(pg_temp.create_sql(p_deal => 4000), 'P0001', 'PREIS_UNGUELTIG', 'Deal-Preis nicht unter Originalpreis');
select throws_ok(pg_temp.create_sql(p_deal => 3900), 'P0001', 'RABATT_ZU_GERING', 'Rabatt unter dem Mindestrabatt');
select throws_ok(pg_temp.create_sql(p_max_per_user => 11), 'P0001', 'UNGUELTIGE_EINGABE', 'Mehr Plätze pro Person als Kontingent');
select throws_ok(pg_temp.create_sql(p_duration => '0'), 'P0001', 'ZEIT_UNGUELTIG', 'Dauer 0');
select throws_ok(pg_temp.create_sql(p_duration => '129601'), 'P0001', 'ZEIT_UNGUELTIG', 'Dauer über 90 Tage');
select throws_ok(pg_temp.create_sql(p_duration => 'null'), 'P0001', 'ZEIT_UNGUELTIG', 'Dauer fehlt');

select lives_ok(pg_temp.create_sql(p_name => '  TEST AUTOTEST Vorlage  ', p_images => 'array['' a.jpg '', ''b.jpg'']'), 'Vorlage anlegen');
select tests.set_id('tpl', (select id from public.offer_templates where name = 'TEST AUTOTEST Vorlage'));
select is(
  (select image_paths from public.offer_templates where id = tests.id('tpl')),
  '{}'::text[], 'Vorlagenbilder werden nicht mehr gespeichert'
);
select is(
  (select location_id from public.offer_templates where id = tests.id('tpl')),
  tests.id('loc'), 'Vorlage gehört zum eigenen Standort'
);
select throws_ok(pg_temp.create_sql(), 'P0001', 'VORLAGENNAME_VERGEBEN', 'Gleicher Name zweimal');
select lives_ok(pg_temp.create_sql(p_name => 'TEST AUTOTEST Ohne Bild', p_images => 'null'), 'Vorlage ohne Bild');
select is(
  (select cardinality(image_paths) from public.offer_templates where name = 'TEST AUTOTEST Ohne Bild'),
  0, 'Ohne Bild gespeichert als leeres Array'
);

-- ---------------------------------------------------------------------------
-- Sichtbarkeit (RLS)
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.offer_templates), 2, 'Standort sieht seine Vorlagen');

select tests.authenticate_as(tests.id('loc2_user'));
select is((select count(*)::int from public.offer_templates), 0, 'Anderer Standort sieht sie nicht');
select lives_ok(pg_temp.create_sql(), 'Gleicher Name bei anderem Standort ist erlaubt');
select throws_ok(pg_temp.update_sql(tests.id('tpl')), 'P0001', 'VORLAGE_NICHT_GEFUNDEN', 'Fremde Vorlage ändern');
select throws_ok(
  format('select public.delete_offer_template(%L)', tests.id('tpl')),
  'P0001', 'VORLAGE_NICHT_GEFUNDEN', 'Fremde Vorlage löschen'
);

select tests.authenticate_as(tests.id('mia'));
select is((select count(*)::int from public.offer_templates), 0, 'Nutzer sehen keine Vorlagen');

select tests.authenticate_as(tests.id('admin'));
select is(
  (select count(*)::int from public.offer_templates
   where location_id in (tests.id('loc'), tests.id('loc2'))),
  3, 'Admin sieht alle'
);

-- ---------------------------------------------------------------------------
-- update_offer_template
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(pg_temp.update_sql(tests.id('tpl'), p_name => 'TEST AUTOTEST Ohne Bild'), 'P0001', 'VORLAGENNAME_VERGEBEN', 'Name einer anderen Vorlage');
select throws_ok(pg_temp.update_sql(tests.id('tpl'), p_deal => 5000), 'P0001', 'PREIS_UNGUELTIG', 'Ändern: Preis ungültig');
select throws_ok(pg_temp.update_sql(gen_random_uuid()), 'P0001', 'VORLAGE_NICHT_GEFUNDEN', 'Unbekannte Vorlage');
select lives_ok(pg_temp.update_sql(tests.id('tpl')), 'Vorlage ändern (gleicher Name bleibt erlaubt)');
select is(
  (select row(title, deal_price_cents, type::text, duration_minutes, cardinality(image_paths))::text
   from public.offer_templates where id = tests.id('tpl')),
  row('TEST AUTOTEST Kochkurs neu', 2000, 'zeitraum', 240, 0)::text, 'Änderungen gespeichert'
);

-- ---------------------------------------------------------------------------
-- Limit: höchstens 30 Vorlagen je Standort
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
insert into public.offer_templates (
  location_id, name, title, description, category, original_price_cents, deal_price_cents,
  capacity, max_per_user, type, duration_minutes
)
select tests.id('loc'), 'TEST AUTOTEST Menge ' || n, 'TEST AUTOTEST Titel', 'Automatisch erzeugte Testvorlage.',
  'sonstiges', 4000, 2400, 10, 2, 'einzeltermin', 60
from generate_series(1, 28) as n;

select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(pg_temp.create_sql(p_name => 'TEST AUTOTEST Nummer 31'), 'P0001', 'VORLAGEN_LIMIT', 'Mehr als 30 Vorlagen');

-- ---------------------------------------------------------------------------
-- delete_offer_template
-- ---------------------------------------------------------------------------
select lives_ok(format('select public.delete_offer_template(%L)', tests.id('tpl')), 'Vorlage löschen');
select is(
  (select count(*)::int from public.offer_templates where id = tests.id('tpl')),
  0, 'Vorlage ist weg'
);
select throws_ok(
  format('select public.delete_offer_template(%L)', tests.id('tpl')),
  'P0001', 'VORLAGE_NICHT_GEFUNDEN', 'Zweimal löschen'
);
select lives_ok(pg_temp.create_sql(p_name => 'TEST AUTOTEST Nummer 30'), 'Nach dem Löschen ist wieder Platz');

select * from finish();
