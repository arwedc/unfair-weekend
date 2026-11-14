-- ============================================================================
-- Seed für das Dev-Projekt (Münster). Einspielen NUR mit `pnpm db:seed`:
-- das Skript legt zuerst die Testkonten über die Auth-Admin-API an und führt
-- dann diese Datei aus. Idempotent: Ist der Seed schon da, passiert nichts.
--
-- Unternehmen und Angebote sind erfunden, die Adressen sind echte Straßen
-- in Münster (Koordinaten aus OpenStreetMap). Angebotsbilder kommen von Unsplash.
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
  select coalesce(array_agg(
    format('https://images.unsplash.com/%s?auto=format&fit=crop&w=1200&q=85', photo.photo_id)
    order by photo.position
  ), '{}'::text[])
  from unnest(case p_slug
    when 'pasta' then array['photo-1556911261-6bd341186b2f']
    when 'sushi' then array['photo-1653233797467-1a528819fd4f']
    when 'burger' then array['photo-1551218808-94e220e084d2']
    when 'wein' then array['photo-1510812431401-41d2bd2722f3']
    when 'padel' then array['photo-1672223550220-df93d147fa4c']
    when 'tennis' then array['photo-1622279457486-62dcc4a431d6']
    when 'soccer' then array['photo-1777715329494-82b92bc4874f']
    when 'keramik' then array['photo-1777315168408-4e366dda1515']
    when 'aquarell' then array['photo-1753098498106-0319c1d646ca']
    when 'comedy' then array['photo-1585699324551-f6c309eedeca', 'photo-1503095396549-807759245b35']
    when 'kino' then array['photo-1489599849927-2ee91cede3ba', 'photo-1478720568477-152d9b164e26']
    when 'outdoor-kino' then array['photo-1770520871616-d7379585fc9a']
    when 'kletterwald' then array['photo-1768350329800-3a3231d18ab3']
    when 'planwagen' then array['photo-1665068960452-eee7367e4e1c']
    when 'kanu' then array['photo-1634001112772-8a46568f0c43']
    when 'tapas' then array['photo-1547592180-85f173990554', 'photo-1512621776951-a57141f2eefd']
    else array['photo-1500530855697-b586d89ba3ee']
  end) with ordinality as photo(photo_id, position)
  where photo.position <= p_count;
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
    (c_yoga, 'Court Club Münster', 'Padel-, Tennis- und Soccer Courts für spontane Matches und Kurse.', 'https://picsum.photos/seed/unfair-logo-courts/256/256'),
    (c_farbraum, 'Atelier Farbraum', 'Offenes Atelier für Keramik, Malerei und Druck.', 'https://picsum.photos/seed/unfair-logo-farbraum/256/256'),
    (c_kultur, 'Kulturkeller Hansaviertel', 'Bühne für Stand-up, Comedy und besondere Filmabende.', 'https://picsum.photos/seed/unfair-logo-kultur/256/256'),
    (c_glow, 'Münster Outdoor Erlebnisse', 'Kletterwald, Draußenkino und aktive Erlebnisse rund um Münster.', 'https://picsum.photos/seed/unfair-logo-outdoor/256/256'),
    (c_radlager, 'StadtLand Erlebnisse', 'Planwagenfahrten und Kanutouren im Münsterland.', 'https://picsum.photos/seed/unfair-logo-stadtland/256/256'),
    (c_morgenrot, 'Bäckerei Morgenrot', 'Handwerksbäckerei mit Backkursen.', null),
    (c_partybus, 'Partybus Münster', 'Partyfahrten durch Münster.', null);

  -- --------------------------------------------------------------------------
  -- Standorte (je ein Login). Koordinaten: OpenStreetMap/Nominatim.
  -- --------------------------------------------------------------------------
  insert into public.locations (id, company_id, account_user_id, name, street, postal_code, city, lat, lng, phone, website, status, status_reason, status_changed_at, status_changed_by, image_paths) values
    (l_ka, c_kochwerk, v_acc_ka, 'Kochwerk Altstadt', 'Prinzipalmarkt 13', '48143', 'Münster', 51.961294, 7.627889, '0251 000101', 'https://example.com/kochwerk', 'approved', null, now() - interval '20 days', v_admin, pg_temp.img('pasta', 2) || pg_temp.img('sushi', 1) || pg_temp.img('tapas', 1)),
    (l_kh, c_kochwerk, v_acc_kh, 'Kochwerk am Hafen', 'Hafenweg 26', '48155', 'Münster', 51.952016, 7.643033, '0251 000102', 'https://example.com/kochwerk', 'approved', null, now() - interval '20 days', v_admin, pg_temp.img('burger', 1) || pg_temp.img('wein', 1)),
    (l_yk, c_yoga, v_acc_yk, 'Padelplätze am Kreuzviertel', 'Kreuzstraße 18', '48143', 'Münster', 51.966257, 7.621257, null, 'https://example.com/courts', 'approved', null, now() - interval '18 days', v_admin, pg_temp.img('padel', 1) || pg_temp.img('tennis', 1)),
    (l_ys, c_yoga, v_acc_ys, 'Soccer Courts Süd', 'Hammer Straße 72', '48153', 'Münster', 51.949422, 7.624187, null, 'https://example.com/courts', 'approved', null, now() - interval '18 days', v_admin, pg_temp.img('soccer', 2)),
    (l_fr, c_farbraum, v_acc_fr, 'Atelier Farbraum', 'Hörster Straße 30', '48143', 'Münster', 51.965513, 7.633168, '0251 000105', null, 'approved', null, now() - interval '15 days', v_admin, pg_temp.img('keramik', 2) || pg_temp.img('aquarell', 1)),
    (l_kk, c_kultur, v_acc_kk, 'Kulturkeller', 'Wolbecker Straße 45', '48155', 'Münster', 51.957779, 7.640222, null, 'https://example.com/kulturkeller', 'approved', null, now() - interval '14 days', v_admin, pg_temp.img('comedy', 2) || pg_temp.img('kino', 1)),
    (l_gl, c_glow, v_acc_gl, 'Münster Outdoor Erlebnisse', 'Aegidiistraße 12', '48143', 'Münster', 51.959762, 7.623360, '0251 000107', null, 'approved', null, now() - interval '12 days', v_admin, pg_temp.img('kletterwald', 1) || pg_temp.img('outdoor-kino', 1) || pg_temp.img('kanu', 1)),
    (l_rl, c_radlager, v_acc_rl, 'Treffpunkt StadtLand Touren', 'Warendorfer Straße 60', '48145', 'Münster', 51.963317, 7.646853, null, null, 'approved', null, now() - interval '10 days', v_admin, pg_temp.img('planwagen', 1) || pg_temp.img('kanu', 1)),
    (l_mr, c_morgenrot, v_acc_mr, 'Bäckerei Morgenrot', 'Grevener Straße 90', '48159', 'Münster', 51.973637, 7.612626, null, null, 'pending', null, null, null, pg_temp.img('pasta', 1)),
    (l_pb, c_partybus, v_acc_pb, 'Partybus Münster', 'Steinfurter Straße 50', '48149', 'Münster', 51.971113, 7.610543, null, null, 'rejected', 'Kein lokales Erlebnisangebot im Sinne der Plattform.', now() - interval '5 days', v_admin, pg_temp.img('planwagen', 1));

  -- --------------------------------------------------------------------------
  -- Angebote: 15 aktuelle Erlebnisse + 3 für Code-Status
  -- --------------------------------------------------------------------------
  insert into public.offers (id, location_id, title, description, category, image_paths, original_price_cents, deal_price_cents, capacity, max_per_user, address, lat, lng, type, starts_at, ends_at, created_by, created_at) values
    ((o || '01')::uuid, l_ka, 'Pasta-Abend: Pasta selbst gemacht / Handmade Pasta Night',
      E'DE: Wir kneten, rollen und füllen gemeinsam Ravioli und Tagliatelle. Anschließend essen wir zusammen; ein Getränk ist inklusive.\n\nEN: Make fresh ravioli and tagliatelle by hand, then sit down for dinner together. One drink is included.',
      'kochen_essen', pg_temp.img('pasta', 3), 4500, 2700, 12, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889,
      'einzeltermin', pg_temp.at_berlin(1, '18:30'), pg_temp.at_berlin(1, '21:30'), v_acc_ka, now() - interval '3 days'),
    ((o || '02')::uuid, l_ka, 'Sushi-Grundkurs / Sushi Making Class',
      E'DE: Lerne Sushi-Reis zuzubereiten und Maki sowie Nigiri zu rollen. Zutaten, Messer und eine kleine Verkostung sind inklusive.\n\nEN: Learn to prepare sushi rice and roll maki and nigiri. Ingredients, knives and a tasting are included.',
      'kochen_essen', pg_temp.img('sushi', 2), 6900, 4500, 10, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889,
      'einzeltermin', pg_temp.at_berlin(4, '18:00'), pg_temp.at_berlin(4, '21:00'), v_acc_ka, now() - interval '2 days'),
    ((o || '03')::uuid, l_kh, 'Streetfood-Burger-Kurs / Street Food Burger Class',
      E'DE: Backe fluffige Buns, würze Patties und rühre eigene Saucen an. Danach grillen und probieren wir gemeinsam am Hafen.\n\nEN: Bake soft buns, season your patties and mix your own sauces. Then grill and enjoy your burgers together by the harbor.',
      'kochen_essen', pg_temp.img('burger', 2), 3900, 2500, 8, 2, 'Hafenweg 26, 48155 Münster', 51.952016, 7.643033,
      'einzeltermin', date_trunc('hour', now()) + interval '3 hours', date_trunc('hour', now()) + interval '5 hours 30 minutes', v_acc_kh, now() - interval '1 day'),
    ((o || '04')::uuid, l_kh, 'Wein & Käse am Hafen / Wine and Cheese by the Harbor',
      E'DE: Probiere sechs Weine kleiner Weingüter mit regionalem Käse und frischem Brot. Einlösbar bis Sonntag; bitte vorher kurz anrufen.\n\nEN: Taste six wines from small producers with local cheese and fresh bread. Valid through Sunday; please call ahead to book.',
      'kochen_essen', pg_temp.img('wein', 2), 3800, 2400, 20, 2, 'Hafenweg 26, 48155 Münster', 51.952016, 7.643033,
      'zeitraum', pg_temp.at_berlin(0, '00:00'), pg_temp.at_berlin(6, '22:00'), v_acc_kh, now() - interval '1 day'),
    ((o || '05')::uuid, l_yk, 'Padelplatz für zwei / Padel Court for Two',
      E'DE: Spiele eine Stunde Padel auf einem beleuchteten Court. Schläger und Bälle sind inklusive; geeignet für Einsteiger:innen und Fortgeschrittene.\n\nEN: Play for one hour on a floodlit padel court. Rackets and balls are included, and all skill levels are welcome.',
      'sport_bewegung', pg_temp.img('padel', 2), 3200, 2200, 20, 2, 'Kreuzstraße 18, 48143 Münster', 51.966257, 7.621257,
      'einzeltermin', pg_temp.at_berlin(2, '19:00'), pg_temp.at_berlin(2, '20:15'), v_acc_yk, now() - interval '4 days'),
    ((o || '06')::uuid, l_yk, 'Tennisplatz: 60 Minuten / Tennis Court: 60 Minutes',
      E'DE: Buche einen Tennisplatz für 60 Minuten und bring deine Mitspieler:innen mit. Schläger können vor Ort ausgeliehen werden; einlösbar innerhalb der nächsten zwei Wochen.\n\nEN: Book a tennis court for 60 minutes and bring your playing partners. Rackets can be rented on site; redeem within the next two weeks.',
      'sport_bewegung', pg_temp.img('tennis', 2), 2400, 1600, 30, 4, 'Kreuzstraße 18, 48143 Münster', 51.966257, 7.621257,
      'zeitraum', pg_temp.at_berlin(-1, '00:00'), pg_temp.at_berlin(13, '21:00'), v_acc_yk, now() - interval '2 days'),
    ((o || '07')::uuid, l_ys, 'Soccer Court: Kleinfeld für 5 / Small-Sided Football Pitch',
      E'DE: Miete ein Kleinfeld für ein schnelles Match mit fünf Personen pro Team. Tore, Bälle und Leibchen sind vor Ort; Umkleiden können genutzt werden.\n\nEN: Rent a small-sided pitch for a quick match with five players per team. Goals, balls and bibs are provided, and changing rooms are available.',
      'sport_bewegung', pg_temp.img('soccer', 2), 4000, 2800, 12, 10, 'Hammer Straße 72, 48153 Münster', 51.949422, 7.624187,
      'einzeltermin', pg_temp.at_berlin(3, '10:00'), pg_temp.at_berlin(3, '11:30'), v_acc_ys, now() - interval '1 day'),
    ((o || '08')::uuid, l_fr, 'Töpferkurs: Becher an der Drehscheibe / Pottery: Make a Wheel-Thrown Mug',
      E'DE: Forme an der Drehscheibe deinen eigenen Becher. Ton, Glasur und Brennen sind inklusive; dein fertiges Stück kannst du nach etwa zwei Wochen abholen.\n\nEN: Shape your own mug on the pottery wheel. Clay, glazing and firing are included; your finished piece will be ready for collection in about two weeks.',
      'kreativ_workshops', pg_temp.img('keramik', 3), 6900, 3900, 8, 2, 'Hörster Straße 30, 48143 Münster', 51.965513, 7.633168,
      'einzeltermin', pg_temp.at_berlin(5, '14:00'), pg_temp.at_berlin(5, '17:00'), v_acc_fr, now() - interval '5 days'),
    ((o || '09')::uuid, l_fr, 'Malkurs: Aquarell für Einsteiger / Watercolor Painting for Beginners',
      E'DE: Entdecke Farbverläufe, Nass-in-Nass-Technik und einfache Lasuren. Papier, Farben und Pinsel liegen bereit; Vorkenntnisse brauchst du nicht.\n\nEN: Explore color washes, wet-on-wet techniques and simple glazes. Paper, paints and brushes are provided, and no previous experience is needed.',
      'kreativ_workshops', pg_temp.img('aquarell', 2), 4200, 2900, 10, 2, 'Hörster Straße 30, 48143 Münster', 51.965513, 7.633168,
      'einzeltermin', pg_temp.at_berlin(8, '18:00'), pg_temp.at_berlin(8, '20:30'), v_acc_fr, now() - interval '1 day'),
    ((o || '10')::uuid, l_kk, 'Stand-up Comedy im Keller / Stand-up Comedy Night',
      E'DE: Freu dich auf einen Abend mit drei Comedians, neuen Pointen und einer offenen Bar. Einlass ab 19:30 Uhr; freie Platzwahl.\n\nEN: Spend the evening with three comedians, fresh jokes and an open bar. Doors open at 7:30 pm; seating is unreserved.',
      'kultur_events', pg_temp.img('comedy', 2), 1800, 900, 60, 4, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222,
      'einzeltermin', pg_temp.at_berlin(6, '20:00'), pg_temp.at_berlin(6, '22:30'), v_acc_kk, now() - interval '6 days'),
    ((o || '11')::uuid, l_kk, 'Kinoticket: Filmabend im Kulturkeller / Movie Night',
      E'DE: Sieh einen ausgewählten Film in gemütlicher Atmosphäre auf großer Leinwand. Das Ticket gilt für eine Vorstellung bis Sonntag; Snacks gibt es an der Bar.\n\nEN: Watch a hand-picked film on the big screen in a cozy venue. The ticket is valid for one screening through Sunday; snacks are available at the bar.',
      'kultur_events', pg_temp.img('kino', 2), 1200, 700, 100, 4, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222,
      'zeitraum', pg_temp.at_berlin(-2, '14:00'), pg_temp.at_berlin(6, '20:00'), v_acc_kk, now() - interval '3 days'),
    ((o || '12')::uuid, l_gl, 'Draußenkino: Filmabend unter Sternen / Open-Air Cinema',
      E'DE: Genieße einen Filmabend unter freiem Himmel. Decken und Kopfhörer werden gestellt; bei Regen gibt es einen Ersatztermin. Einlass eine Stunde vor Filmbeginn.\n\nEN: Enjoy a film under the open sky. Blankets and headphones are provided; in case of rain, the screening will be rescheduled. Doors open one hour before the film.',
      'kultur_events', pg_temp.img('outdoor-kino', 2), 1500, 800, 15, 2, 'Aegidiistraße 12, 48143 Münster', 51.959762, 7.623360,
      'einzeltermin', pg_temp.at_berlin(4, '21:00'), pg_temp.at_berlin(4, '23:00'), v_acc_gl, now() - interval '2 days'),
    ((o || '13')::uuid, l_gl, 'Kletterwald: Tagesticket / Forest Ropes Course Day Pass',
      E'DE: Wage dich über Hängebrücken und Seilrutschen durch die Baumwipfel. Das Tagesticket umfasst die Einweisung und alle Parcours; feste Schuhe sind nötig.\n\nEN: Cross rope bridges and zip lines high among the trees. The day pass includes a safety briefing and access to all courses; sturdy shoes are required.',
      'sport_bewegung', pg_temp.img('kletterwald', 2), 3900, 2600, 3, 1, 'Aegidiistraße 12, 48143 Münster', 51.959762, 7.623360,
      'einzeltermin', pg_temp.at_berlin(1, '11:00'), pg_temp.at_berlin(1, '16:00'), v_acc_gl, now() - interval '1 day'),
    ((o || '14')::uuid, l_rl, 'Planwagenfahrt durchs Münsterland / Covered Wagon Ride',
      E'DE: Entdecke die Landschaft rund um Münster bei einer gemütlichen Planwagenfahrt. Die zweistündige Tour startet am Treffpunkt; Getränke können mitgebracht werden.\n\nEN: Explore the countryside around Münster on a relaxed covered wagon ride. The two-hour tour leaves from the meeting point; you are welcome to bring drinks.',
      'sonstiges', pg_temp.img('planwagen', 2), 3600, 2400, 10, 4, 'Warendorfer Straße 60, 48145 Münster', 51.963317, 7.646853,
      'einzeltermin', pg_temp.at_berlin(7, '17:00'), pg_temp.at_berlin(7, '19:00'), v_acc_rl, now() - interval '2 days'),
    ((o || '15')::uuid, l_rl, 'Kanutour auf der Werse / Canoe Tour on the Werse',
      E'DE: Paddel in ruhigem Tempo auf der Werse und entdecke die Natur am Stadtrand. Kanu, Schwimmweste und wasserdichte Tonne sind inklusive; Schwimmkenntnisse sind erforderlich.\n\nEN: Paddle at an easy pace along the Werse and enjoy the nature just outside the city. Canoe, life jacket and dry barrel are included; basic swimming ability is required.',
      'sport_bewegung', pg_temp.img('kanu', 2), 3500, 2200, 25, 2, 'Warendorfer Straße 60, 48145 Münster', 51.963317, 7.646853,
      'zeitraum', pg_temp.at_berlin(0, '08:00'), pg_temp.at_berlin(30, '18:00'), v_acc_rl, now() - interval '1 day'),
    -- vergangen bzw. abgesagt (für Codes in allen Status)
    ((o || '16')::uuid, l_ka, 'Tapas-Abend / Tapas Night',
      E'DE: Teile eine Auswahl spanischer Tapas in geselliger Runde. Kleine Gerichte und alkoholfreie Getränke sind inklusive.\n\nEN: Share a selection of Spanish tapas in a relaxed group. Small plates and non-alcoholic drinks are included.',
      'kochen_essen', pg_temp.img('tapas', 2), 4000, 2600, 12, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889,
      'einzeltermin', pg_temp.at_berlin(-1, '18:00'), pg_temp.at_berlin(-1, '21:00'), v_acc_ka, now() - interval '8 days'),
    ((o || '17')::uuid, l_kk, 'Kino: Last-Minute-Ticket / Last-Minute Cinema Ticket',
      E'DE: Ein Ticket für eine Vorstellung deiner Wahl im kleinen Kinosaal. Snacks und Getränke bekommst du an der Bar.\n\nEN: One ticket for a screening of your choice in the intimate cinema room. Snacks and drinks are available at the bar.',
      'kultur_events', pg_temp.img('kino', 1), 1200, 700, 10, 1, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222,
      'zeitraum', pg_temp.at_berlin(-10, '09:00'), pg_temp.at_berlin(-3, '20:00'), v_acc_kk, now() - interval '12 days'),
    ((o || '18')::uuid, l_kk, 'Stand-up Comedy Special / Stand-up Comedy Special',
      E'DE: Ein Comedy-Abend mit Gästen aus der Region, kurzen Sets und anschließendem Austausch an der Bar.\n\nEN: A comedy night with local performers, short sets and a chance to mingle at the bar afterwards.',
      'kultur_events', pg_temp.img('comedy', 2), 1800, 1000, 40, 2, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222,
      'einzeltermin', pg_temp.at_berlin(9, '20:00'), pg_temp.at_berlin(9, '22:30'), v_acc_kk, now() - interval '4 days');

  update public.offers
  set status = 'abgesagt', status_reason = 'Ein Comedian ist leider erkrankt.', status_changed_at = now() - interval '1 day',
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
