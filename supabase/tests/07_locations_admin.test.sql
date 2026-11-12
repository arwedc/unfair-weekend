-- Registrierung, Freischalten/Ablehnen, Einstellungen, Kennzahlen
select no_plan();

select tests.set_id('admin', tests.create_admin());
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('neu', tests.create_user('autotest+neu@example.com', '{"account_type":"standort"}'));
select tests.set_id('neu2', tests.create_user('autotest+neu2@example.com', '{"account_type":"standort"}'));

-- Admin wird nie über Metadaten vergeben
select tests.set_id('frech', tests.create_user('autotest+frech@example.com', '{"account_type":"admin","role":"admin"}'));
select is((select role::text from public.profiles where id = tests.id('frech')), 'nutzer', 'Metadaten machen niemanden zum Admin');
select is((select role::text from public.profiles where id = tests.id('neu')), 'standort', 'account_type standort → Rolle standort');

-- Namen aus OAuth-Metadaten
select tests.set_id('google', tests.create_user('autotest+google@example.com', '{"full_name":"Lea Maria Schulz"}'));
select is((select first_name || '|' || last_name from public.profiles where id = tests.id('google')), 'Lea|Maria Schulz', 'full_name wird in Vor- und Nachname aufgeteilt');

-- ---------------------------------------------------------------------------
-- register_company
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('mia'));
select throws_ok(
  $$ select public.register_company('Firma', 'Standort', 'Straße 1', '48143', 'Münster') $$,
  'P0001', 'KEIN_STANDORTKONTO', 'Nutzerkonto kann kein Unternehmen registrieren'
);

select tests.authenticate_as(tests.id('neu'));
select throws_ok(
  $$ select public.register_company('Firma', 'Standort', 'Straße 1', '4814', 'Münster') $$,
  'P0001', 'UNGUELTIGE_EINGABE', 'PLZ mit 4 Ziffern'
);
select throws_ok(
  $$ select public.register_company('Firma', 'Standort', 'Straße 1', '48143', 'Münster', null, 51.9) $$,
  'P0001', 'UNGUELTIGE_EINGABE', 'nur eine Koordinate'
);
select tests.set_id('neu_loc', (public.register_company(
  ' TEST AUTOTEST Kochschule ', 'TEST AUTOTEST Altstadt', 'Ludgeristraße 1', '48143', 'Münster',
  'Beschreibung', 51.9605, 7.6265, '0251 123', 'https://example.com'
) ->> 'location_id')::uuid);
select throws_ok(
  $$ select public.register_company('Noch eine', 'Standort', 'Straße 1', '48143', 'Münster') $$,
  'P0001', 'STANDORT_EXISTIERT_BEREITS', 'genau ein Standort pro Login'
);
select is((select status::text from public.locations where id = tests.id('neu_loc')), 'pending', 'neuer Standort ist pending');
select is((select name from public.companies), 'TEST AUTOTEST Kochschule', 'Unternehmensname getrimmt, eigenes Unternehmen sichtbar');
select is((public.get_my_account() -> 'location' ->> 'status'), 'pending', 'get_my_account zeigt den Status');

-- Stammdaten dürfen schon vor der Freischaltung gepflegt werden
select is(
  (select name from public.update_my_location('TEST AUTOTEST Altstadt Neu', 'Ludgeristraße 2', '48143', 'Münster')),
  'TEST AUTOTEST Altstadt Neu', 'update_my_location im Status pending'
);
select is(
  (select description from public.update_my_company('TEST AUTOTEST Kochschule', 'Neue Beschreibung', 'firma/logo.png')),
  'Neue Beschreibung', 'update_my_company'
);

-- ---------------------------------------------------------------------------
-- Freischalten / Ablehnen
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('neu'));
select throws_ok(format('select public.approve_location(%L)', tests.id('neu_loc')), 'P0001', 'KEIN_ZUGRIFF', 'Standort kann sich nicht selbst freischalten');

select tests.authenticate_as(tests.id('admin'));
select is((select status::text from public.approve_location(tests.id('neu_loc'))), 'approved', 'Admin schaltet frei');
select throws_ok(format('select public.approve_location(%L)', tests.id('neu_loc')), 'P0001', 'STATUS_UNGUELTIG', 'nicht doppelt freischalten');
select throws_ok(format('select public.approve_location(%L)', gen_random_uuid()), 'P0001', 'STANDORT_NICHT_GEFUNDEN', 'unbekannter Standort');

-- Zweiter Standort wird dem bestehenden Unternehmen zugeordnet
select tests.authenticate_as(tests.id('neu2'));
select tests.set_id('neu2_loc', (public.register_company('TEST AUTOTEST Doppelt', 'TEST AUTOTEST Hafen', 'Hafenweg 1', '48155', 'Münster') ->> 'location_id')::uuid);
select tests.clear_authentication();
select tests.set_id('neu2_company', (select company_id from public.locations where id = tests.id('neu2_loc')));
select tests.set_id('ziel_company', (select company_id from public.locations where id = tests.id('neu_loc')));

select tests.authenticate_as(tests.id('admin'));
select throws_ok(
  format('select public.approve_location(%L, %L)', tests.id('neu2_loc'), gen_random_uuid()),
  'P0001', 'UNTERNEHMEN_NICHT_GEFUNDEN', 'Zusammenführen mit unbekanntem Unternehmen'
);
select is(
  (select company_id from public.approve_location(tests.id('neu2_loc'), tests.id('ziel_company'))),
  tests.id('ziel_company'), 'Freischalten mit Zuordnung zum bestehenden Unternehmen'
);
select is((select count(*)::int from public.companies where id = tests.id('neu2_company')), 0, 'leeres Unternehmen wird gelöscht');

-- Sperren nach Freischaltung: aktive Angebote werden abgesagt
select tests.clear_authentication();
select tests.set_id('offer', tests.create_offer(tests.id('neu_loc')));
select tests.set_id('offer_alt', tests.create_offer(tests.id('neu_loc')));
update public.offers set status = 'abgesagt' where id = tests.id('offer_alt');
select tests.set_id('v', tests.create_voucher(tests.id('offer'), tests.id('mia'), 2));

select tests.authenticate_as(tests.id('admin'));
select is(
  public.reject_location(tests.id('neu_loc'), 'Beschwerden') - 'location_id',
  '{"status": "rejected", "cancelled_offers": 1, "cancelled_vouchers": 1}'::jsonb,
  'reject_location sagt aktive Angebote ab'
);
select throws_ok(format('select public.reject_location(%L)', tests.id('neu_loc')), 'P0001', 'STATUS_UNGUELTIG', 'nicht doppelt ablehnen');
select tests.clear_authentication();
select is((select status_reason from public.locations where id = tests.id('neu_loc')), 'Beschwerden', 'Begründung gespeichert');
select is((select count(*)::int from public.notification_outbox where voucher_id = tests.id('v')), 1, 'Code-Inhaber wird benachrichtigt');
select is((select seats_taken from public.offers where id = tests.id('offer')), 0, 'Plätze freigegeben');

select tests.authenticate_as(tests.id('neu'));
select throws_ok(
  $$ select public.create_offer('TEST AUTOTEST Gesperrt', 'Darf nicht mehr anlegen.', 'sonstiges', array['x'], 5000, 3000, 5, 1, 'Ludgeristraße 1, Münster', 51.96, 7.62, 'einzeltermin', now() + interval '1 day', now() + interval '1 day 1 hour') $$,
  'P0001', 'STANDORT_NICHT_FREIGESCHALTET', 'abgelehnter Standort kann keine Angebote anlegen'
);
select tests.authenticate_as(tests.id('admin'));
select is((select status::text from public.approve_location(tests.id('neu_loc'))), 'approved', 'abgelehnten Standort wieder freischalten');

-- ---------------------------------------------------------------------------
-- Einstellungen
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('mia'));
select throws_ok('select public.update_settings(10, 2, 3, 14, 1)', 'P0001', 'KEIN_ZUGRIFF', 'nur Admins ändern Einstellungen');
select tests.authenticate_as(tests.id('admin'));
select throws_ok('select public.update_settings(101, 2, 3, 14, 1)', 'P0001', 'UNGUELTIGE_EINGABE', 'Mindestrabatt > 100');
select throws_ok('select public.update_settings(10, 2, 0, 14, 1)', 'P0001', 'UNGUELTIGE_EINGABE', 'No-Show-Limit 0');
select is(
  (select row(min_discount_percent, cancel_deadline_hours, no_show_limit, block_days, reminder_hours_before)::text
   from public.update_settings(10, 2, 3, 14, 1)),
  '(10,2,3,14,1)', 'Admin ändert alle Einstellungen'
);
select is((select updated_by from public.settings), tests.id('admin'), 'updated_by gesetzt');
select is((public.get_settings()).min_discount_percent, 10, 'get_settings liefert die neuen Werte');

-- ---------------------------------------------------------------------------
-- Kennzahlen
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
delete from public.events;
select tests.set_id('k_offer', tests.create_offer(tests.id('neu_loc')));
insert into public.events (type, offer_id, location_id, category, seats, created_at)
select t.type::public.event_type, tests.id('k_offer'), tests.id('neu_loc'), 'kochen_essen', t.seats, now() - t.ago
from (values
  ('angebot_angesehen', null, interval '1 hour'),
  ('angebot_angesehen', null, interval '1 hour'),
  ('code_geholt', 2, interval '1 hour'),
  ('code_geholt', 1, interval '1 hour'),
  ('code_geholt', 1, interval '1 hour'),
  ('code_geholt', 1, interval '1 hour'),
  ('code_storniert', 1, interval '1 hour'),
  ('code_eingeloest', 2, interval '1 hour'),
  ('code_eingeloest', 1, interval '1 hour'),
  ('no_show', 1, interval '1 hour'),
  ('code_geholt', 1, interval '400 days')
) as t(type, seats, ago);

select tests.authenticate_as(tests.id('mia'));
select throws_ok('select public.get_admin_metrics()', 'P0001', 'KEIN_ZUGRIFF', 'Kennzahlen nur für Admins');

select tests.authenticate_as(tests.id('admin'));
select is(
  public.get_admin_metrics() -> 'totals',
  '{"views": 2, "claims": 4, "claimed_seats": 5, "cancellations": 1, "redemptions": 2, "redeemed_seats": 3, "no_shows": 1, "redemption_rate": 0.667}'::jsonb,
  'Summen im Standardzeitraum (alte Events ausgeschlossen), Einlösequote = 2 / (4 − 1)'
);
select is(jsonb_array_length(public.get_admin_metrics() -> 'by_week'), 1, 'eine Woche mit Daten');
select is(
  (public.get_admin_metrics() -> 'by_location' -> 0 ->> 'location_name'),
  'TEST AUTOTEST Altstadt Neu', 'pro Standort mit Namen'
);
select is((public.get_admin_metrics() -> 'by_category' -> 0 ->> 'category'), 'kochen_essen', 'pro Kategorie');
select ok((public.get_admin_metrics() -> 'current') ? 'pending_locations', 'aktuelle Bestandszahlen');
select is(
  (public.get_admin_metrics((current_date - 500), current_date) -> 'totals' ->> 'claims')::int,
  5, 'eigener Zeitraum schließt alte Events ein'
);
select throws_ok('select public.get_admin_metrics(current_date, current_date - 1)', 'P0001', 'UNGUELTIGE_EINGABE', 'Beginn nach Ende');

select * from finish();
