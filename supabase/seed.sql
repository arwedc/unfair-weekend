-- ============================================================================
-- Seed für das Dev-Projekt (Münster). Einspielen NUR mit `pnpm db:seed`:
-- das Skript legt zuerst die Testkonten über die Auth-Admin-API an und führt
-- dann diese Datei aus. Idempotent: Ist der Seed schon da, passiert nichts.
--
-- Unternehmen und Angebote sind erfunden, die Adressen sind echte Straßen
-- in Münster (Koordinaten aus OpenStreetMap). Bilder: Platzhalter von picsum.photos.
-- Zeiten sind relativ zum Zeitpunkt des Einspielens (Europe/Berlin).
--
-- Seed-Daten nicht von Hand ändern (Regel in CLAUDE.md).
-- ============================================================================

-- Zeitpunkt in Berliner Ortszeit: heute + p_days um p_time
create function pg_temp.at_berlin(p_days integer, p_time time)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'Europe/Berlin')::date + p_days) + p_time) at time zone 'Europe/Berlin';
$$;

create function pg_temp.img(p_slug text, p_count integer default 2)
returns text[]
language sql
immutable
as $$
  select array_agg(format('https://picsum.photos/seed/unfair-%s-%s/1200/900', p_slug, i) order by i)
  from generate_series(1, p_count) as i;
$$;

do $seed$
declare
  -- Konten (angelegt von pnpm db:seed)
  v_admin uuid := (select id from auth.users where email = 'seed-admin@example.com');
  v_mia uuid := (select id from auth.users where email = 'seed-mia@example.com');
  v_jonas uuid := (select id from auth.users where email = 'seed-jonas@example.com');
  v_lea uuid := (select id from auth.users where email = 'seed-lea@example.com');
  v_acc_ka uuid := (select id from auth.users where email = 'seed-kochwerk-altstadt@example.com');
  v_acc_kh uuid := (select id from auth.users where email = 'seed-kochwerk-hafen@example.com');
  v_acc_yk uuid := (select id from auth.users where email = 'seed-yoga-kreuzviertel@example.com');
  v_acc_ys uuid := (select id from auth.users where email = 'seed-yoga-suedviertel@example.com');
  v_acc_fr uuid := (select id from auth.users where email = 'seed-farbraum@example.com');
  v_acc_kk uuid := (select id from auth.users where email = 'seed-kulturkeller@example.com');
  v_acc_gl uuid := (select id from auth.users where email = 'seed-glow@example.com');
  v_acc_rl uuid := (select id from auth.users where email = 'seed-radlager@example.com');
  v_acc_mr uuid := (select id from auth.users where email = 'seed-morgenrot@example.com');
  v_acc_pb uuid := (select id from auth.users where email = 'seed-partybus@example.com');

  -- feste IDs, damit der Seed erkennbar und idempotent ist
  c_kochwerk constant uuid := '5eed0000-0000-4000-8000-000000000101';
  c_yoga constant uuid := '5eed0000-0000-4000-8000-000000000102';
  c_farbraum constant uuid := '5eed0000-0000-4000-8000-000000000103';
  c_kultur constant uuid := '5eed0000-0000-4000-8000-000000000104';
  c_glow constant uuid := '5eed0000-0000-4000-8000-000000000105';
  c_radlager constant uuid := '5eed0000-0000-4000-8000-000000000106';
  c_morgenrot constant uuid := '5eed0000-0000-4000-8000-000000000107';
  c_partybus constant uuid := '5eed0000-0000-4000-8000-000000000108';

  l_ka constant uuid := '5eed0000-0000-4000-8000-000000000201';
  l_kh constant uuid := '5eed0000-0000-4000-8000-000000000202';
  l_yk constant uuid := '5eed0000-0000-4000-8000-000000000203';
  l_ys constant uuid := '5eed0000-0000-4000-8000-000000000204';
  l_fr constant uuid := '5eed0000-0000-4000-8000-000000000205';
  l_kk constant uuid := '5eed0000-0000-4000-8000-000000000206';
  l_gl constant uuid := '5eed0000-0000-4000-8000-000000000207';
  l_rl constant uuid := '5eed0000-0000-4000-8000-000000000208';
  l_mr constant uuid := '5eed0000-0000-4000-8000-000000000209';
  l_pb constant uuid := '5eed0000-0000-4000-8000-000000000210';

  o constant text := '5eed0000-0000-4000-8000-0000000003';
begin
  if exists (select 1 from public.companies where id = c_kochwerk) then
    raise notice 'Seed ist bereits vorhanden, nichts zu tun.';
    return;
  end if;

  if v_admin is null or v_mia is null or v_jonas is null or v_lea is null
    or v_acc_ka is null or v_acc_kh is null or v_acc_yk is null or v_acc_ys is null or v_acc_fr is null
    or v_acc_kk is null or v_acc_gl is null or v_acc_rl is null or v_acc_mr is null or v_acc_pb is null then
    raise exception 'Seed-Konten fehlen. Bitte mit „pnpm db:seed“ einspielen, nicht direkt.';
  end if;

  -- --------------------------------------------------------------------------
  -- Rollen und Profile (Profile legt der Trigger handle_new_user an)
  -- --------------------------------------------------------------------------
  update public.profiles set role = 'admin' where id = v_admin;
  update public.profiles set no_show_count = 1 where id = v_jonas;

  -- --------------------------------------------------------------------------
  -- Unternehmen
  -- --------------------------------------------------------------------------
  insert into public.companies (id, name, description, logo_path) values
    (c_kochwerk, 'Kochwerk Münster', 'Kochschule mit zwei Küchen in der Altstadt und am Hafen. Kleine Gruppen, regionale Zutaten.', 'https://picsum.photos/seed/unfair-logo-kochwerk/256/256'),
    (c_yoga, 'Yoga & Move', 'Yoga, Pilates und Mobility für alle Level im Kreuzviertel und Südviertel.', 'https://picsum.photos/seed/unfair-logo-yoga/256/256'),
    (c_farbraum, 'Atelier Farbraum', 'Offenes Atelier für Keramik, Malerei und Druck.', 'https://picsum.photos/seed/unfair-logo-farbraum/256/256'),
    (c_kultur, 'Kulturkeller Hansaviertel', 'Bühne für Slam, Jazz, Lesungen und kleine Ausstellungen.', 'https://picsum.photos/seed/unfair-logo-kultur/256/256'),
    (c_glow, 'Glow Beauty Lounge', 'Kosmetik, Nägel und Massagen in der Altstadt.', 'https://picsum.photos/seed/unfair-logo-glow/256/256'),
    (c_radlager, 'Radlager Werkstatt', 'Fahrradwerkstatt mit Selbsthilfe-Kursen.', 'https://picsum.photos/seed/unfair-logo-radlager/256/256'),
    (c_morgenrot, 'Bäckerei Morgenrot', 'Handwerksbäckerei mit Backkursen.', null),
    (c_partybus, 'Partybus Münster', 'Partyfahrten durch Münster.', null);

  -- --------------------------------------------------------------------------
  -- Standorte (je ein Login). Koordinaten: OpenStreetMap/Nominatim.
  -- --------------------------------------------------------------------------
  insert into public.locations (id, company_id, account_user_id, name, street, postal_code, city, lat, lng, phone, website, status, status_reason, status_changed_at, status_changed_by) values
    (l_ka, c_kochwerk, v_acc_ka, 'Kochwerk Altstadt', 'Prinzipalmarkt 13', '48143', 'Münster', 51.961294, 7.627889, '0251 000101', 'https://example.com/kochwerk', 'approved', null, now() - interval '20 days', v_admin),
    (l_kh, c_kochwerk, v_acc_kh, 'Kochwerk am Hafen', 'Hafenweg 26', '48155', 'Münster', 51.952016, 7.643033, '0251 000102', 'https://example.com/kochwerk', 'approved', null, now() - interval '20 days', v_admin),
    (l_yk, c_yoga, v_acc_yk, 'Yoga & Move Kreuzviertel', 'Kreuzstraße 18', '48143', 'Münster', 51.966257, 7.621257, null, 'https://example.com/yoga', 'approved', null, now() - interval '18 days', v_admin),
    (l_ys, c_yoga, v_acc_ys, 'Yoga & Move Südviertel', 'Hammer Straße 72', '48153', 'Münster', 51.949422, 7.624187, null, 'https://example.com/yoga', 'approved', null, now() - interval '18 days', v_admin),
    (l_fr, c_farbraum, v_acc_fr, 'Atelier Farbraum', 'Hörster Straße 30', '48143', 'Münster', 51.965513, 7.633168, '0251 000105', null, 'approved', null, now() - interval '15 days', v_admin),
    (l_kk, c_kultur, v_acc_kk, 'Kulturkeller', 'Wolbecker Straße 45', '48155', 'Münster', 51.957779, 7.640222, null, 'https://example.com/kulturkeller', 'approved', null, now() - interval '14 days', v_admin),
    (l_gl, c_glow, v_acc_gl, 'Glow Beauty Lounge', 'Aegidiistraße 12', '48143', 'Münster', 51.959762, 7.623360, '0251 000107', null, 'approved', null, now() - interval '12 days', v_admin),
    (l_rl, c_radlager, v_acc_rl, 'Radlager Werkstatt', 'Warendorfer Straße 60', '48145', 'Münster', 51.963317, 7.646853, null, null, 'approved', null, now() - interval '10 days', v_admin),
    (l_mr, c_morgenrot, v_acc_mr, 'Bäckerei Morgenrot', 'Grevener Straße 90', '48159', 'Münster', 51.973637, 7.612626, null, null, 'pending', null, null, null),
    (l_pb, c_partybus, v_acc_pb, 'Partybus Münster', 'Steinfurter Straße 50', '48149', 'Münster', 51.971113, 7.610543, null, null, 'rejected', 'Kein lokales Erlebnisangebot im Sinne der Plattform.', now() - interval '5 days', v_admin);

  -- --------------------------------------------------------------------------
  -- Angebote: 15 aktuelle (beide Arten, alle Kategorien) + 3 für Code-Status
  -- --------------------------------------------------------------------------
  insert into public.offers (id, location_id, title, description, category, image_paths, original_price_cents, deal_price_cents, capacity, max_per_user, address, lat, lng, type, starts_at, ends_at, created_by, created_at) values
    ((o || '01')::uuid, l_ka, 'Pasta-Abend: frische Pasta von Hand',
      'Wir kneten, rollen und füllen zusammen Ravioli und Tagliatelle. Danach essen wir gemeinsam, ein Glas Wein ist dabei.',
      'kochen_essen', pg_temp.img('pasta', 3), 4500, 2700, 12, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889,
      'einzeltermin', pg_temp.at_berlin(1, '18:30'), pg_temp.at_berlin(1, '21:30'), v_acc_ka, now() - interval '3 days'),
    ((o || '02')::uuid, l_ka, 'Sushi-Grundkurs',
      'Reis richtig kochen, Fisch schneiden, Maki und Nigiri rollen. Alle Zutaten und Messer werden gestellt.',
      'kochen_essen', pg_temp.img('sushi', 2), 6900, 4500, 10, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889,
      'einzeltermin', pg_temp.at_berlin(4, '18:00'), pg_temp.at_berlin(4, '21:00'), v_acc_ka, now() - interval '2 days'),
    ((o || '03')::uuid, l_kh, 'Streetfood-Burger-Kurs am Hafen',
      'Buns backen, Patties formen, Saucen anrühren: Burger vom Grill mit Blick aufs Wasser. Startet heute!',
      'kochen_essen', pg_temp.img('burger', 2), 3900, 2500, 8, 2, 'Hafenweg 26, 48155 Münster', 51.952016, 7.643033,
      'einzeltermin', date_trunc('hour', now()) + interval '3 hours', date_trunc('hour', now()) + interval '5 hours 30 minutes', v_acc_kh, now() - interval '1 day'),
    ((o || '04')::uuid, l_kh, 'Weinprobe für zwei am Hafen',
      'Sechs Weine aus kleinen Weingütern mit Käse und Brot. Einlösbar an jedem Abend bis Sonntag, bitte kurz vorher anrufen.',
      'kochen_essen', pg_temp.img('wein', 2), 3800, 2400, 20, 2, 'Hafenweg 26, 48155 Münster', 51.952016, 7.643033,
      'zeitraum', pg_temp.at_berlin(0, '00:00'), pg_temp.at_berlin(6, '22:00'), v_acc_kh, now() - interval '1 day'),
    ((o || '05')::uuid, l_yk, 'Sunset-Yoga im Kreuzviertel',
      'Ruhiger Vinyasa-Flow zum Feierabend, für alle Level. Matten sind vorhanden.',
      'sport_bewegung', pg_temp.img('yoga-sunset', 2), 1800, 900, 20, 2, 'Kreuzstraße 18, 48143 Münster', 51.966257, 7.621257,
      'einzeltermin', pg_temp.at_berlin(2, '19:00'), pg_temp.at_berlin(2, '20:15'), v_acc_yk, now() - interval '4 days'),
    ((o || '06')::uuid, l_yk, 'Yoga-Probestunde nach Wahl',
      'Eine Stunde aus dem Kursplan nach Wahl. Einlösbar in den nächsten zwei Wochen.',
      'sport_bewegung', pg_temp.img('yoga-probe', 1), 1500, 500, 30, 1, 'Kreuzstraße 18, 48143 Münster', 51.966257, 7.621257,
      'zeitraum', pg_temp.at_berlin(-1, '00:00'), pg_temp.at_berlin(13, '21:00'), v_acc_yk, now() - interval '2 days'),
    ((o || '07')::uuid, l_ys, 'Pilates Intensiv',
      '90 Minuten Mattenpilates mit Fokus auf Rumpf und Rücken.',
      'sport_bewegung', pg_temp.img('pilates', 2), 2200, 1300, 12, 2, 'Hammer Straße 72, 48153 Münster', 51.949422, 7.624187,
      'einzeltermin', pg_temp.at_berlin(3, '10:00'), pg_temp.at_berlin(3, '11:30'), v_acc_ys, now() - interval '1 day'),
    ((o || '08')::uuid, l_fr, 'Keramik-Workshop: Becher drehen',
      'An der Drehscheibe entstehen zwei eigene Becher. Glasieren und Brennen übernehmen wir, Abholung nach zwei Wochen.',
      'kreativ_workshops', pg_temp.img('keramik', 3), 6900, 3900, 8, 2, 'Hörster Straße 30, 48143 Münster', 51.965513, 7.633168,
      'einzeltermin', pg_temp.at_berlin(5, '14:00'), pg_temp.at_berlin(5, '17:00'), v_acc_fr, now() - interval '5 days'),
    ((o || '09')::uuid, l_fr, 'Aquarell für Einsteiger',
      'Farben mischen, Nass-in-Nass, Lasuren: Grundlagen an einem Abend. Material inklusive.',
      'kreativ_workshops', pg_temp.img('aquarell', 2), 4200, 2900, 10, 2, 'Hörster Straße 30, 48143 Münster', 51.965513, 7.633168,
      'einzeltermin', pg_temp.at_berlin(8, '18:00'), pg_temp.at_berlin(8, '20:30'), v_acc_fr, now() - interval '1 day'),
    ((o || '10')::uuid, l_kk, 'Poetry Slam im Keller',
      'Sechs Slammer:innen, ein Publikum, eine Krone. Einlass 19:30 Uhr.',
      'kultur_events', pg_temp.img('slam', 2), 1200, 600, 60, 4, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222,
      'einzeltermin', pg_temp.at_berlin(6, '20:00'), pg_temp.at_berlin(6, '22:30'), v_acc_kk, now() - interval '6 days'),
    ((o || '11')::uuid, l_kk, 'Ausstellung „Stadtlicht“: Eintritt',
      'Fotografien von Münster bei Nacht. Einlösbar zu den Öffnungszeiten (Mi. bis So., 14 bis 20 Uhr).',
      'kultur_events', pg_temp.img('stadtlicht', 2), 1000, 500, 100, 4, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222,
      'zeitraum', pg_temp.at_berlin(-2, '14:00'), pg_temp.at_berlin(20, '20:00'), v_acc_kk, now() - interval '3 days'),
    ((o || '12')::uuid, l_gl, 'Gesichtsbehandlung 60 Minuten',
      'Reinigung, Peeling, Maske und Massage. Termin nach Absprache innerhalb von zwei Wochen.',
      'wellness_beauty', pg_temp.img('facial', 2), 7900, 4900, 15, 1, 'Aegidiistraße 12, 48143 Münster', 51.959762, 7.623360,
      'zeitraum', pg_temp.at_berlin(-1, '09:00'), pg_temp.at_berlin(14, '20:00'), v_acc_gl, now() - interval '2 days'),
    ((o || '13')::uuid, l_gl, 'Maniküre Last Minute',
      'Klassische Maniküre mit Lack nach Wahl. Nur drei Plätze.',
      'wellness_beauty', pg_temp.img('manikuere', 1), 3500, 2100, 3, 1, 'Aegidiistraße 12, 48143 Münster', 51.959762, 7.623360,
      'einzeltermin', pg_temp.at_berlin(1, '11:00'), pg_temp.at_berlin(1, '12:00'), v_acc_gl, now() - interval '1 day'),
    ((o || '14')::uuid, l_rl, 'Fahrrad-Reparaturkurs für Einsteiger',
      'Schlauch flicken, Bremsen einstellen, Kette pflegen. Bring dein eigenes Rad mit.',
      'sonstiges', pg_temp.img('fahrrad-kurs', 2), 3000, 1500, 10, 1, 'Warendorfer Straße 60, 48145 Münster', 51.963317, 7.646853,
      'einzeltermin', pg_temp.at_berlin(7, '17:00'), pg_temp.at_berlin(7, '19:00'), v_acc_rl, now() - interval '2 days'),
    ((o || '15')::uuid, l_rl, 'Fahrrad-Check inkl. Bremsen',
      'Durchsicht mit Bremsen, Schaltung und Licht. Einlösbar in den nächsten vier Wochen.',
      'sonstiges', pg_temp.img('fahrrad-check', 1), 2500, 1200, 25, 1, 'Warendorfer Straße 60, 48145 Münster', 51.963317, 7.646853,
      'zeitraum', pg_temp.at_berlin(0, '08:00'), pg_temp.at_berlin(30, '18:00'), v_acc_rl, now() - interval '1 day'),
    -- vergangen bzw. abgesagt (für Codes in allen Status)
    ((o || '16')::uuid, l_ka, 'Tapas-Abend',
      'Spanische Tapas für einen geselligen Abend.',
      'kochen_essen', pg_temp.img('tapas', 2), 4000, 2600, 12, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889,
      'einzeltermin', pg_temp.at_berlin(-1, '18:00'), pg_temp.at_berlin(-1, '21:00'), v_acc_ka, now() - interval '8 days'),
    ((o || '17')::uuid, l_gl, 'Rückenmassage 30 Minuten',
      'Entspannende Rückenmassage mit warmem Öl.',
      'wellness_beauty', pg_temp.img('massage', 1), 4500, 2900, 10, 1, 'Aegidiistraße 12, 48143 Münster', 51.959762, 7.623360,
      'zeitraum', pg_temp.at_berlin(-10, '09:00'), pg_temp.at_berlin(-3, '20:00'), v_acc_gl, now() - interval '12 days'),
    ((o || '18')::uuid, l_kk, 'Jazz im Keller',
      'Trio-Abend mit Standards und eigenen Stücken.',
      'kultur_events', pg_temp.img('jazz', 2), 1800, 1000, 40, 2, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222,
      'einzeltermin', pg_temp.at_berlin(9, '20:00'), pg_temp.at_berlin(9, '22:30'), v_acc_kk, now() - interval '4 days');

  update public.offers
  set status = 'abgesagt', status_reason = 'Die Band ist leider erkrankt.', status_changed_at = now() - interval '1 day',
      status_changed_by = v_acc_kk
  where id = (o || '18')::uuid;

  -- --------------------------------------------------------------------------
  -- Codes in allen Status
  -- --------------------------------------------------------------------------
  insert into public.vouchers (offer_id, user_id, seats, token, short_code, status, claimed_at, cancelled_at, cancel_reason, redeemed_at, redeemed_by, no_show_at, no_show_by, expired_at)
  select (o || x.offer)::uuid, x.user_id, x.seats, private.generate_token(), private.generate_short_code(),
    x.status::public.voucher_status, now() - x.claimed_ago,
    case when x.status = 'storniert' then now() - x.claimed_ago + interval '2 hours' end,
    x.reason::public.voucher_cancel_reason,
    case when x.status = 'eingeloest' then pg_temp.at_berlin(-1, '17:55') end,
    case when x.status = 'eingeloest' then v_acc_ka end,
    case when x.status = 'no_show' then pg_temp.at_berlin(-1, '18:30') end,
    case when x.status = 'no_show' then v_acc_ka end,
    case when x.status = 'abgelaufen' then pg_temp.at_berlin(-3, '20:05') end
  from (values
    ('01', v_mia, 2, 'aktiv', null, interval '20 hours'),
    ('12', v_mia, 1, 'aktiv', null, interval '30 hours'),
    ('16', v_mia, 2, 'eingeloest', null, interval '4 days'),
    ('02', v_mia, 1, 'storniert', 'nutzer', interval '2 days'),
    ('13', v_jonas, 1, 'aktiv', null, interval '10 hours'),
    ('05', v_jonas, 2, 'aktiv', null, interval '2 days'),
    ('16', v_jonas, 1, 'no_show', null, interval '3 days'),
    ('08', v_lea, 2, 'aktiv', null, interval '1 day'),
    ('13', v_lea, 1, 'aktiv', null, interval '5 hours'),
    ('17', v_lea, 1, 'abgelaufen', null, interval '8 days'),
    ('18', v_lea, 1, 'storniert', 'angebot_abgesagt', interval '3 days')
  ) as x(offer, user_id, seats, status, reason, claimed_ago);

  -- belegte Plätze passend zu den Codes
  update public.offers ofr
  set seats_taken = coalesce((
    select sum(v.seats) from public.vouchers v
    where v.offer_id = ofr.id and v.status in ('aktiv', 'eingeloest', 'no_show')
  ), 0)
  where ofr.id::text like '5eed0000-0000-4000-8000-0000000003%';

  -- --------------------------------------------------------------------------
  -- Favoriten
  -- --------------------------------------------------------------------------
  insert into public.favorite_locations (user_id, location_id) values (v_mia, l_ka), (v_lea, l_gl);
  insert into public.favorite_categories (user_id, category) values
    (v_mia, 'kochen_essen'), (v_jonas, 'sport_bewegung'), (v_lea, 'wellness_beauty'), (v_lea, 'kreativ_workshops');

  -- --------------------------------------------------------------------------
  -- Kennzahlen-Events: Aufrufe und alle Code-Ereignisse
  -- --------------------------------------------------------------------------
  insert into public.events (type, offer_id, location_id, category, created_at)
  select 'angebot_angesehen', ofr.id, ofr.location_id, ofr.category,
    ofr.created_at + (i * interval '97 minutes')
  from public.offers ofr
  cross join lateral generate_series(1, 5 + abs(hashtext(ofr.id::text)) % 20) as i
  where ofr.id::text like '5eed0000-0000-4000-8000-0000000003%'
    and ofr.created_at + (i * interval '97 minutes') < now();

  insert into public.events (type, offer_id, location_id, category, user_id, voucher_id, seats, created_at)
  select e.type::public.event_type, v.offer_id, ofr.location_id, ofr.category, v.user_id, v.id, v.seats, e.at
  from public.vouchers v
  join public.offers ofr on ofr.id = v.offer_id
  cross join lateral (values
    ('code_geholt', v.claimed_at),
    ('code_storniert', v.cancelled_at),
    ('code_eingeloest', v.redeemed_at),
    ('no_show', v.no_show_at)
  ) as e(type, at)
  where ofr.id::text like '5eed0000-0000-4000-8000-0000000003%' and e.at is not null;

  raise notice 'Seed eingespielt: 8 Unternehmen, 10 Standorte, 18 Angebote, 11 Codes.';
end;
$seed$;
