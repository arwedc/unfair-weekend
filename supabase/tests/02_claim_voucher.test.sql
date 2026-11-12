-- claim_voucher: alle Prüfungen und Fehlercodes
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('loc_pending', tests.create_location('pending'));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));
select tests.set_id('ohne_name', tests.create_user('autotest+ohnename@example.com'));
select tests.set_id('gesperrt', tests.create_nutzer('Gesperrt'));
update public.profiles set blocked_until = now() + interval '5 days' where id = tests.id('gesperrt');
select tests.set_id('war_gesperrt', tests.create_nutzer('Frei'));
update public.profiles set blocked_until = now() - interval '1 minute' where id = tests.id('war_gesperrt');

select tests.set_id('offer', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '1 day', now() + interval '1 day 2 hours', 3, 2));
select tests.set_id('begonnen', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '5 minutes', now() + interval '2 hours'));
select tests.set_id('zr_laeuft', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '2 days', now() + interval '2 days'));
select tests.set_id('zr_zukunft', tests.create_offer(tests.id('loc'), 'zeitraum', now() + interval '2 days', now() + interval '5 days'));
select tests.set_id('zr_vorbei', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '5 days', now() - interval '1 minute'));
select tests.set_id('abgesagt', tests.create_offer(tests.id('loc')));
update public.offers set status = 'abgesagt' where id = tests.id('abgesagt');
select tests.set_id('pending_offer', tests.create_offer(tests.id('loc_pending')));

-- ---------------------------------------------------------------------------
-- Konto-Prüfungen
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'P0001', 'NUR_NUTZER', 'Standort-Konto kann keine Codes holen');

select tests.authenticate_as(tests.id('ohne_name'));
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'P0001', 'PROFIL_UNVOLLSTAENDIG', 'ohne Vor- und Nachname kein Code');

select tests.authenticate_as(tests.id('gesperrt'));
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'P0001', 'GESPERRT', 'gesperrter Nutzer');
select matches(
  (select tests.error_code(format('select public.claim_voucher(%L, 1)', tests.id('offer')))),
  'GESPERRT', 'Fehlercode GESPERRT (Detail nennt das Datum)'
);

select tests.authenticate_as(tests.id('war_gesperrt'));
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('zr_laeuft')), 'abgelaufene Sperre blockiert nicht mehr');

-- ---------------------------------------------------------------------------
-- Angebots-Prüfungen
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('mia'));
select throws_ok(format('select public.claim_voucher(%L, 0)', tests.id('offer')), 'P0001', 'UNGUELTIGE_PLATZANZAHL', '0 Plätze');
select throws_ok(format('select public.claim_voucher(%L, null)', tests.id('offer')), 'P0001', 'UNGUELTIGE_PLATZANZAHL', 'null Plätze');
select throws_ok(format('select public.claim_voucher(%L, 1)', gen_random_uuid()), 'P0001', 'ANGEBOT_NICHT_GEFUNDEN', 'unbekanntes Angebot');
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('abgesagt')), 'P0001', 'ANGEBOT_NICHT_AKTIV', 'abgesagtes Angebot');
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('pending_offer')), 'P0001', 'ANGEBOT_NICHT_AKTIV', 'Standort nicht freigeschaltet');
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('begonnen')), 'P0001', 'ANGEBOT_BEGONNEN', 'Einzeltermin hat begonnen');
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('zr_vorbei')), 'P0001', 'ANGEBOT_ABGELAUFEN', 'Zeitraum abgelaufen');
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('zr_laeuft')), 'laufender Zeitraum: holbar');
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('zr_zukunft')), 'Zeitraum vor Beginn: schon holbar');
select throws_ok(format('select public.claim_voucher(%L, 3)', tests.id('offer')), 'P0001', 'ZU_VIELE_PLAETZE', 'mehr als max_per_user');

-- ---------------------------------------------------------------------------
-- Plätze und Ergebnis
-- ---------------------------------------------------------------------------
select tests.set_id('v_mia', (select id from public.claim_voucher(tests.id('offer'), 2)));
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'P0001', 'BEREITS_AKTIVER_CODE', 'höchstens ein aktiver Code pro Angebot');

select tests.authenticate_as(tests.id('jonas'));
select throws_ok(format('select public.claim_voucher(%L, 2)', tests.id('offer')), 'P0001', 'AUSGEBUCHT', 'nur noch 1 Platz frei, 2 gewünscht');
select is(
  (select tests.error_code(format('select public.claim_voucher(%L, 2)', tests.id('offer')))),
  'AUSGEBUCHT', 'Fehlercode AUSGEBUCHT'
);
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'letzter Platz geht noch');
select tests.clear_authentication();
select tests.set_id('nachzuegler', tests.create_nutzer('Nachzügler'));
select tests.authenticate_as(tests.id('nachzuegler'));
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'P0001', 'AUSGEBUCHT', 'danach ausgebucht');

select tests.clear_authentication();
select is((select seats_taken from public.offers where id = tests.id('offer')), 3, 'seats_taken = Kontingent, nie mehr');
select throws_ok(
  format('update public.offers set seats_taken = 4 where id = %L', tests.id('offer')),
  '23514', null, 'CHECK verhindert Überbuchung auch bei direktem Schreiben'
);

select matches((select token from public.vouchers where id = tests.id('v_mia')), '^[A-Za-z0-9_-]{43}$', 'Token: 43 Zeichen base64url');
select matches((select short_code from public.vouchers where id = tests.id('v_mia')), '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}$', 'Kurzcode ohne verwechselbare Zeichen');
select is((select count(distinct token)::int from public.vouchers where offer_id = tests.id('offer')), 2, 'Tokens sind verschieden');
select is(
  (select count(*)::int from public.events where type = 'code_geholt' and offer_id = tests.id('offer')),
  2, 'Event code_geholt je Code'
);
select is(
  (select seats from public.events where type = 'code_geholt' and voucher_id = tests.id('v_mia')),
  2, 'Event enthält die Plätze'
);

-- Nach Storno darf derselbe Nutzer erneut holen
select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.cancel_voucher(%L)', tests.id('v_mia')), 'Mia storniert');
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('offer')), 'Mia holt erneut einen Code');

select * from finish();
