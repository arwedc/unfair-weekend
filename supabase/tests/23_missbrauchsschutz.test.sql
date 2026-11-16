-- Missbrauchsschutz: Limits für Codes, Aufrufe ohne Login, Uploads vor der Freischaltung
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('pending', tests.create_location('pending'));
select tests.set_id('pending_user', tests.location_user(tests.id('pending')));
select tests.set_id('pending_company', (select company_id from public.locations where id = tests.id('pending')));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));

select tests.set_id('o1', tests.create_offer(tests.id('loc')));
select tests.set_id('o2', tests.create_offer(tests.id('loc')));
select tests.set_id('o3', tests.create_offer(tests.id('loc')));
select tests.set_id('o4', tests.create_offer(tests.id('loc')));

select is((select max_active_vouchers from public.settings), 5, 'Standard: 5 aktive Codes');
select is((select max_claims_per_day from public.settings), 10, 'Standard: 10 Codes pro 24 Std.');

-- ---------------------------------------------------------------------------
-- Aktive Codes pro Nutzer
-- ---------------------------------------------------------------------------
update public.settings set max_active_vouchers = 2, max_claims_per_day = 3;

select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('o1')), '1. aktiver Code');
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('o2')), '2. aktiver Code');
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('o3')), 'P0001', 'ZU_VIELE_AKTIVE_CODES', 'Limit aktiver Codes greift');
select tests.clear_authentication();
select is((select seats_taken from public.offers where id = tests.id('o3')), 0, 'abgelehnter Claim belegt keinen Platz');
select tests.authenticate_as(tests.id('mia'));

-- Storno macht wieder Platz, zählt aber weiter fürs Tageslimit
select lives_ok(
  format('select public.cancel_voucher(%L)', (select id from public.vouchers where offer_id = tests.id('o1') and user_id = tests.id('mia'))),
  'Storno'
);
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('o3')), 'nach Storno wieder möglich (3. Code heute)');
select lives_ok(
  format('select public.cancel_voucher(%L)', (select id from public.vouchers where offer_id = tests.id('o3') and user_id = tests.id('mia'))),
  'Storno 2'
);
select throws_ok(format('select public.claim_voucher(%L, 1)', tests.id('o4')), 'P0001', 'TAGESLIMIT_ERREICHT', 'Tageslimit zählt stornierte Codes mit');

-- Limits gelten pro Nutzer
select tests.authenticate_as(tests.id('jonas'));
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('o4')), 'anderer Nutzer ist nicht betroffen');

-- Ältere Codes zählen nicht mehr fürs Tageslimit
select tests.clear_authentication();
update public.vouchers set claimed_at = now() - interval '25 hours' where user_id = tests.id('mia');
select tests.authenticate_as(tests.id('mia'));
select lives_ok(format('select public.claim_voucher(%L, 1)', tests.id('o4')), 'nach 24 Std. wieder möglich');

-- ---------------------------------------------------------------------------
-- Aufrufe ohne Login: höchstens 120 pro Angebot und Stunde
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
insert into public.events (type, offer_id, location_id, category, created_at)
select 'angebot_angesehen', o.id, o.location_id, o.category, now() - interval '2 hours'
from public.offers o, generate_series(1, 150) where o.id = tests.id('o1');
insert into public.events (type, offer_id, location_id, category)
select 'angebot_angesehen', o.id, o.location_id, o.category
from public.offers o, generate_series(1, 119) where o.id = tests.id('o1');

create function pg_temp.anon_views(p_offer uuid) returns integer language sql as $$
  select count(*)::integer from public.events
  where type = 'angebot_angesehen' and offer_id = p_offer and user_id is null
    and created_at > now() - interval '1 hour';
$$;

select tests.authenticate_as_anon();
select lives_ok(format('select public.log_offer_view(%L)', tests.id('o1')), '120. Aufruf zählt');
select lives_ok(format('select public.log_offer_view(%L)', tests.id('o1')), '121. Aufruf wirft keinen Fehler');
select lives_ok(format('select public.log_offer_view(%L)', tests.id('o2')), 'anderes Angebot zählt weiter');
select tests.clear_authentication();
select is(pg_temp.anon_views(tests.id('o1')), 120, 'ohne Login: bei 120 pro Stunde ist Schluss (ältere zählen nicht)');
select is(pg_temp.anon_views(tests.id('o2')), 1, 'Deckel gilt pro Angebot');

select tests.authenticate_as(tests.id('jonas'));
select lives_ok(format('select public.log_offer_view(%L)', tests.id('o1')), 'angemeldet');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.events where type = 'angebot_angesehen' and offer_id = tests.id('o1') and user_id = tests.id('jonas')),
  1, 'angemeldete Nutzer zählen trotz Deckel'
);

-- ---------------------------------------------------------------------------
-- Uploads vor der Freischaltung
-- ---------------------------------------------------------------------------
select tests.authenticate_as(tests.id('pending_user'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) select 'offer-images', %L || '/autotest-' || n || '.jpg' from generate_series(1, 10) n $$, tests.id('pending')),
  'nicht freigeschaltet: 10 Bilder gehen'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('offer-images', %L) $$, tests.id('pending') || '/autotest-11.jpg'),
  '42501', null, 'nicht freigeschaltet: das 11. Bild wird abgelehnt'
);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) select 'company-logos', %L || '/logo-' || n || '.png' from generate_series(1, 5) n $$, tests.id('pending_company')),
  'nicht freigeschaltet: 5 Logos gehen'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('company-logos', %L) $$, tests.id('pending_company') || '/logo-6.png'),
  '42501', null, 'nicht freigeschaltet: das 6. Logo wird abgelehnt'
);

select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) select 'offer-images', %L || '/autotest-' || n || '.jpg' from generate_series(1, 15) n $$, tests.id('loc')),
  'freigeschaltet: keine Obergrenze'
);

select tests.authenticate_as(tests.id('mia'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('avatars', %L) $$, tests.id('mia') || '/autotest.jpg'),
  'Profilbilder sind nicht betroffen'
);

-- Nach der Freischaltung fällt die Obergrenze weg
select tests.clear_authentication();
update public.locations set status = 'approved' where id = tests.id('pending');
select tests.authenticate_as(tests.id('pending_user'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('offer-images', %L) $$, tests.id('pending') || '/autotest-11.jpg'),
  'nach der Freischaltung geht das 11. Bild'
);

select * from finish();
