-- Ersetzt die bisherigen Demo-Angebote durch lokale Freizeit- und Kultur-Erlebnisse.
-- Die Seed-IDs bleiben erhalten, damit bereits angelegte Demo-Codes gültig bleiben.

create function pg_temp.at_berlin(p_days integer, p_time time)
returns timestamptz
language sql
stable
as $$
  select (((now() at time zone 'Europe/Berlin')::date + p_days) + p_time) at time zone 'Europe/Berlin';
$$;

create function pg_temp.img(p_slug text, p_count integer)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(
    format('https://images.unsplash.com/%s?auto=format&fit=crop&w=1200&q=85', photo.photo_id)
    order by photo.position
  ), '{}'::text[])
  from unnest(case p_slug
    when 'pasta' then array['photo-1556911220-bff31c812dba', 'photo-1556911261-6bd341186b2f', 'photo-1556909114-f6e7ad7d3136']
    when 'sushi' then array['photo-1579871494447-9811cf80d66c', 'photo-1579584425555-c3ce17fd4351']
    when 'burger' then array['photo-1550547660-d9450f859349', 'photo-1568901346375-23c9450c58cd']
    when 'wein' then array['photo-1510812431401-41d2bd2722f3', 'photo-1516594915697-87eb3b1c14ea']
    when 'padel' then array['photo-1595435934249-5df7ed86e1c0', 'photo-1554068865-24cecd4e34b8']
    when 'tennis' then array['photo-1622279457486-62dcc4a431d6', 'photo-1554068865-24cecd4e34b8']
    when 'soccer' then array['photo-1521412644187-c49fa049e84d', 'photo-1574629810360-7efbbe195018']
    when 'keramik' then array['photo-1565193566173-7a0ee3dbe261', 'photo-1578749556568-bc2c40e68b61', 'photo-1493106641515-6b5631de4bb9']
    when 'aquarell' then array['photo-1513364776144-60967b0f800f', 'photo-1460661419201-fd4cecdf8a8b']
    when 'comedy' then array['photo-1585699324551-f6c309eedeca', 'photo-1503095396549-807759245b35']
    when 'kino' then array['photo-1489599849927-2ee91cede3ba', 'photo-1478720568477-152d9b164e26']
    when 'outdoor-kino' then array['photo-1478720568477-152d9b164e26', 'photo-1500530855697-b586d89ba3ee']
    when 'kletterwald' then array['photo-1522163182402-834f871fd851', 'photo-1473448912268-2022ce9509d8']
    when 'planwagen' then array['photo-1500530855697-b586d89ba3ee', 'photo-1472396961693-142e6e269027']
    when 'kanu' then array['photo-1504851149312-7a075b496cc7', 'photo-1500530855697-b586d89ba3ee']
    when 'tapas' then array['photo-1547592180-85f173990554', 'photo-1512621776951-a57141f2eefd']
    else array['photo-1500530855697-b586d89ba3ee']
  end) with ordinality as photo(photo_id, position)
  where photo.position <= p_count;
$$;

update public.companies as c
set name = v.name, description = v.description, logo_path = v.logo_path
from (values
  ('5eed0000-0000-4000-8000-000000000102'::uuid, 'Court Club Münster', 'Padel-, Tennis- und Soccer Courts für spontane Matches und Kurse.', 'https://picsum.photos/seed/unfair-logo-courts/256/256'),
  ('5eed0000-0000-4000-8000-000000000104'::uuid, 'Kulturkeller Hansaviertel', 'Bühne für Stand-up, Comedy und besondere Filmabende.', 'https://picsum.photos/seed/unfair-logo-kultur/256/256'),
  ('5eed0000-0000-4000-8000-000000000105'::uuid, 'Münster Outdoor Erlebnisse', 'Kletterwald, Draußenkino und aktive Erlebnisse rund um Münster.', 'https://picsum.photos/seed/unfair-logo-outdoor/256/256'),
  ('5eed0000-0000-4000-8000-000000000106'::uuid, 'StadtLand Erlebnisse', 'Planwagenfahrten und Kanutouren im Münsterland.', 'https://picsum.photos/seed/unfair-logo-stadtland/256/256')
) as v(id, name, description, logo_path)
where c.id = v.id;

update public.locations as l
set name = v.name, website = v.website, image_paths = v.image_paths
from (values
  ('5eed0000-0000-4000-8000-000000000201'::uuid, 'Kochwerk Altstadt', 'https://example.com/kochwerk', pg_temp.img('pasta', 2) || pg_temp.img('sushi', 1) || pg_temp.img('tapas', 1)),
  ('5eed0000-0000-4000-8000-000000000202'::uuid, 'Kochwerk am Hafen', 'https://example.com/kochwerk', pg_temp.img('burger', 1) || pg_temp.img('wein', 1)),
  ('5eed0000-0000-4000-8000-000000000203'::uuid, 'Padelplätze am Kreuzviertel', 'https://example.com/courts', pg_temp.img('padel', 1) || pg_temp.img('tennis', 1)),
  ('5eed0000-0000-4000-8000-000000000204'::uuid, 'Soccer Courts Süd', 'https://example.com/courts', pg_temp.img('soccer', 2)),
  ('5eed0000-0000-4000-8000-000000000205'::uuid, 'Atelier Farbraum', null, pg_temp.img('keramik', 2) || pg_temp.img('aquarell', 1)),
  ('5eed0000-0000-4000-8000-000000000206'::uuid, 'Kulturkeller', 'https://example.com/kulturkeller', pg_temp.img('comedy', 2) || pg_temp.img('kino', 1)),
  ('5eed0000-0000-4000-8000-000000000207'::uuid, 'Münster Outdoor Erlebnisse', null, pg_temp.img('kletterwald', 1) || pg_temp.img('outdoor-kino', 1) || pg_temp.img('kanu', 1)),
  ('5eed0000-0000-4000-8000-000000000208'::uuid, 'Treffpunkt StadtLand Touren', null, pg_temp.img('planwagen', 1) || pg_temp.img('kanu', 1))
) as v(id, name, website, image_paths)
where l.id = v.id;

with offer_data (
  id, location_id, title, description, category, original_price_cents, deal_price_cents,
  capacity, max_per_user, address, lat, lng, type, starts_at, ends_at
) as (values
  ('5eed0000-0000-4000-8000-000000000301'::uuid, '5eed0000-0000-4000-8000-000000000201'::uuid, 'Pasta-Abend: Pasta selbst gemacht / Handmade Pasta Night',
    E'DE: Wir kneten, rollen und füllen gemeinsam Ravioli und Tagliatelle. Anschließend essen wir zusammen; ein Getränk ist inklusive.\n\nEN: Make fresh ravioli and tagliatelle by hand, then sit down for dinner together. One drink is included.',
    'kochen_essen', 4500, 2700, 12, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889, 'einzeltermin', pg_temp.at_berlin(1, '18:30'), pg_temp.at_berlin(1, '21:30')),
  ('5eed0000-0000-4000-8000-000000000302'::uuid, '5eed0000-0000-4000-8000-000000000201'::uuid, 'Sushi-Grundkurs / Sushi Making Class',
    E'DE: Lerne Sushi-Reis zuzubereiten und Maki sowie Nigiri zu rollen. Zutaten, Messer und eine kleine Verkostung sind inklusive.\n\nEN: Learn to prepare sushi rice and roll maki and nigiri. Ingredients, knives and a tasting are included.',
    'kochen_essen', 6900, 4500, 10, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889, 'einzeltermin', pg_temp.at_berlin(4, '18:00'), pg_temp.at_berlin(4, '21:00')),
  ('5eed0000-0000-4000-8000-000000000303'::uuid, '5eed0000-0000-4000-8000-000000000202'::uuid, 'Streetfood-Burger-Kurs / Street Food Burger Class',
    E'DE: Backe fluffige Buns, würze Patties und rühre eigene Saucen an. Danach grillen und probieren wir gemeinsam am Hafen.\n\nEN: Bake soft buns, season your patties and mix your own sauces. Then grill and enjoy your burgers together by the harbor.',
    'kochen_essen', 3900, 2500, 8, 2, 'Hafenweg 26, 48155 Münster', 51.952016, 7.643033, 'einzeltermin', now() + interval '3 hours', now() + interval '5 hours 30 minutes'),
  ('5eed0000-0000-4000-8000-000000000304'::uuid, '5eed0000-0000-4000-8000-000000000202'::uuid, 'Wein & Käse am Hafen / Wine and Cheese by the Harbor',
    E'DE: Probiere sechs Weine kleiner Weingüter mit regionalem Käse und frischem Brot. Einlösbar bis Sonntag; bitte vorher kurz anrufen.\n\nEN: Taste six wines from small producers with local cheese and fresh bread. Valid through Sunday; please call ahead to book.',
    'kochen_essen', 3800, 2400, 20, 2, 'Hafenweg 26, 48155 Münster', 51.952016, 7.643033, 'zeitraum', pg_temp.at_berlin(0, '00:00'), pg_temp.at_berlin(6, '22:00')),
  ('5eed0000-0000-4000-8000-000000000305'::uuid, '5eed0000-0000-4000-8000-000000000203'::uuid, 'Padelplatz für zwei / Padel Court for Two',
    E'DE: Spiele eine Stunde Padel auf einem beleuchteten Court. Schläger und Bälle sind inklusive; geeignet für Einsteiger:innen und Fortgeschrittene.\n\nEN: Play for one hour on a floodlit padel court. Rackets and balls are included, and all skill levels are welcome.',
    'sport_bewegung', 3200, 2200, 20, 2, 'Kreuzstraße 18, 48143 Münster', 51.966257, 7.621257, 'einzeltermin', pg_temp.at_berlin(2, '19:00'), pg_temp.at_berlin(2, '20:15')),
  ('5eed0000-0000-4000-8000-000000000306'::uuid, '5eed0000-0000-4000-8000-000000000203'::uuid, 'Tennisplatz: 60 Minuten / Tennis Court: 60 Minutes',
    E'DE: Buche einen Tennisplatz für 60 Minuten und bring deine Mitspieler:innen mit. Schläger können vor Ort ausgeliehen werden; einlösbar innerhalb der nächsten zwei Wochen.\n\nEN: Book a tennis court for 60 minutes and bring your playing partners. Rackets can be rented on site; redeem within the next two weeks.',
    'sport_bewegung', 2400, 1600, 30, 4, 'Kreuzstraße 18, 48143 Münster', 51.966257, 7.621257, 'zeitraum', pg_temp.at_berlin(-1, '00:00'), pg_temp.at_berlin(13, '21:00')),
  ('5eed0000-0000-4000-8000-000000000307'::uuid, '5eed0000-0000-4000-8000-000000000204'::uuid, 'Soccer Court: Kleinfeld für 5 / Small-Sided Football Pitch',
    E'DE: Miete ein Kleinfeld für ein schnelles Match mit fünf Personen pro Team. Tore, Bälle und Leibchen sind vor Ort; Umkleiden können genutzt werden.\n\nEN: Rent a small-sided pitch for a quick match with five players per team. Goals, balls and bibs are provided, and changing rooms are available.',
    'sport_bewegung', 4000, 2800, 12, 10, 'Hammer Straße 72, 48153 Münster', 51.949422, 7.624187, 'einzeltermin', pg_temp.at_berlin(3, '10:00'), pg_temp.at_berlin(3, '11:30')),
  ('5eed0000-0000-4000-8000-000000000308'::uuid, '5eed0000-0000-4000-8000-000000000205'::uuid, 'Töpferkurs: Becher an der Drehscheibe / Pottery: Make a Wheel-Thrown Mug',
    E'DE: Forme an der Drehscheibe deinen eigenen Becher. Ton, Glasur und Brennen sind inklusive; dein fertiges Stück kannst du nach etwa zwei Wochen abholen.\n\nEN: Shape your own mug on the pottery wheel. Clay, glazing and firing are included; your finished piece will be ready for collection in about two weeks.',
    'kreativ_workshops', 6900, 3900, 8, 2, 'Hörster Straße 30, 48143 Münster', 51.965513, 7.633168, 'einzeltermin', pg_temp.at_berlin(5, '14:00'), pg_temp.at_berlin(5, '17:00')),
  ('5eed0000-0000-4000-8000-000000000309'::uuid, '5eed0000-0000-4000-8000-000000000205'::uuid, 'Malkurs: Aquarell für Einsteiger / Watercolor Painting for Beginners',
    E'DE: Entdecke Farbverläufe, Nass-in-Nass-Technik und einfache Lasuren. Papier, Farben und Pinsel liegen bereit; Vorkenntnisse brauchst du nicht.\n\nEN: Explore color washes, wet-on-wet techniques and simple glazes. Paper, paints and brushes are provided, and no previous experience is needed.',
    'kreativ_workshops', 4200, 2900, 10, 2, 'Hörster Straße 30, 48143 Münster', 51.965513, 7.633168, 'einzeltermin', pg_temp.at_berlin(8, '18:00'), pg_temp.at_berlin(8, '20:30')),
  ('5eed0000-0000-4000-8000-000000000310'::uuid, '5eed0000-0000-4000-8000-000000000206'::uuid, 'Stand-up Comedy im Keller / Stand-up Comedy Night',
    E'DE: Freu dich auf einen Abend mit drei Comedians, neuen Pointen und einer offenen Bar. Einlass ab 19:30 Uhr; freie Platzwahl.\n\nEN: Spend the evening with three comedians, fresh jokes and an open bar. Doors open at 7:30 pm; seating is unreserved.',
    'kultur_events', 1800, 900, 60, 4, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222, 'einzeltermin', pg_temp.at_berlin(6, '20:00'), pg_temp.at_berlin(6, '22:30')),
  ('5eed0000-0000-4000-8000-000000000311'::uuid, '5eed0000-0000-4000-8000-000000000206'::uuid, 'Kinoticket: Filmabend im Kulturkeller / Movie Night',
    E'DE: Sieh einen ausgewählten Film in gemütlicher Atmosphäre auf großer Leinwand. Das Ticket gilt für eine Vorstellung bis Sonntag; Snacks gibt es an der Bar.\n\nEN: Watch a hand-picked film on the big screen in a cozy venue. The ticket is valid for one screening through Sunday; snacks are available at the bar.',
    'kultur_events', 1200, 700, 100, 4, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222, 'zeitraum', pg_temp.at_berlin(-2, '14:00'), pg_temp.at_berlin(6, '20:00')),
  ('5eed0000-0000-4000-8000-000000000312'::uuid, '5eed0000-0000-4000-8000-000000000207'::uuid, 'Draußenkino: Filmabend unter Sternen / Open-Air Cinema',
    E'DE: Genieße einen Filmabend unter freiem Himmel. Decken und Kopfhörer werden gestellt; bei Regen gibt es einen Ersatztermin. Einlass eine Stunde vor Filmbeginn.\n\nEN: Enjoy a film under the open sky. Blankets and headphones are provided; in case of rain, the screening will be rescheduled. Doors open one hour before the film.',
    'kultur_events', 1500, 800, 15, 2, 'Aegidiistraße 12, 48143 Münster', 51.959762, 7.623360, 'einzeltermin', pg_temp.at_berlin(4, '21:00'), pg_temp.at_berlin(4, '23:00')),
  ('5eed0000-0000-4000-8000-000000000313'::uuid, '5eed0000-0000-4000-8000-000000000207'::uuid, 'Kletterwald: Tagesticket / Forest Ropes Course Day Pass',
    E'DE: Wage dich über Hängebrücken und Seilrutschen durch die Baumwipfel. Das Tagesticket umfasst die Einweisung und alle Parcours; feste Schuhe sind nötig.\n\nEN: Cross rope bridges and zip lines high among the trees. The day pass includes a safety briefing and access to all courses; sturdy shoes are required.',
    'sport_bewegung', 3900, 2600, 3, 1, 'Aegidiistraße 12, 48143 Münster', 51.959762, 7.623360, 'einzeltermin', pg_temp.at_berlin(1, '11:00'), pg_temp.at_berlin(1, '16:00')),
  ('5eed0000-0000-4000-8000-000000000314'::uuid, '5eed0000-0000-4000-8000-000000000208'::uuid, 'Planwagenfahrt durchs Münsterland / Covered Wagon Ride',
    E'DE: Entdecke die Landschaft rund um Münster bei einer gemütlichen Planwagenfahrt. Die zweistündige Tour startet am Treffpunkt; Getränke können mitgebracht werden.\n\nEN: Explore the countryside around Münster on a relaxed covered wagon ride. The two-hour tour leaves from the meeting point; you are welcome to bring drinks.',
    'sonstiges', 3600, 2400, 10, 4, 'Warendorfer Straße 60, 48145 Münster', 51.963317, 7.646853, 'einzeltermin', pg_temp.at_berlin(7, '17:00'), pg_temp.at_berlin(7, '19:00')),
  ('5eed0000-0000-4000-8000-000000000315'::uuid, '5eed0000-0000-4000-8000-000000000208'::uuid, 'Kanutour auf der Werse / Canoe Tour on the Werse',
    E'DE: Paddel in ruhigem Tempo auf der Werse und entdecke die Natur am Stadtrand. Kanu, Schwimmweste und wasserdichte Tonne sind inklusive; Schwimmkenntnisse sind erforderlich.\n\nEN: Paddle at an easy pace along the Werse and enjoy the nature just outside the city. Canoe, life jacket and dry barrel are included; basic swimming ability is required.',
    'sport_bewegung', 3500, 2200, 25, 2, 'Warendorfer Straße 60, 48145 Münster', 51.963317, 7.646853, 'zeitraum', pg_temp.at_berlin(0, '08:00'), pg_temp.at_berlin(30, '18:00')),
  ('5eed0000-0000-4000-8000-000000000316'::uuid, '5eed0000-0000-4000-8000-000000000201'::uuid, 'Tapas-Abend / Tapas Night',
    E'DE: Teile eine Auswahl spanischer Tapas in geselliger Runde. Kleine Gerichte und alkoholfreie Getränke sind inklusive.\n\nEN: Share a selection of Spanish tapas in a relaxed group. Small plates and non-alcoholic drinks are included.',
    'kochen_essen', 4000, 2600, 12, 2, 'Prinzipalmarkt 13, 48143 Münster', 51.961294, 7.627889, 'einzeltermin', pg_temp.at_berlin(-1, '18:00'), pg_temp.at_berlin(-1, '21:00')),
  ('5eed0000-0000-4000-8000-000000000317'::uuid, '5eed0000-0000-4000-8000-000000000206'::uuid, 'Kino: Last-Minute-Ticket / Last-Minute Cinema Ticket',
    E'DE: Ein Ticket für eine Vorstellung deiner Wahl im kleinen Kinosaal. Snacks und Getränke bekommst du an der Bar.\n\nEN: One ticket for a screening of your choice in the intimate cinema room. Snacks and drinks are available at the bar.',
    'kultur_events', 1200, 700, 10, 1, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222, 'zeitraum', pg_temp.at_berlin(-10, '09:00'), pg_temp.at_berlin(-3, '20:00')),
  ('5eed0000-0000-4000-8000-000000000318'::uuid, '5eed0000-0000-4000-8000-000000000206'::uuid, 'Stand-up Comedy Special / Stand-up Comedy Special',
    E'DE: Ein Comedy-Abend mit Gästen aus der Region, kurzen Sets und anschließendem Austausch an der Bar.\n\nEN: A comedy night with local performers, short sets and a chance to mingle at the bar afterwards.',
    'kultur_events', 1800, 1000, 40, 2, 'Wolbecker Straße 45, 48155 Münster', 51.957779, 7.640222, 'einzeltermin', pg_temp.at_berlin(9, '20:00'), pg_temp.at_berlin(9, '22:30'))
)
update public.offers as o
set location_id = d.location_id,
    title = d.title,
    description = d.description,
    category = d.category::public.offer_category,
    image_paths = '{}'::text[],
    original_price_cents = d.original_price_cents,
    deal_price_cents = d.deal_price_cents,
    capacity = d.capacity,
    max_per_user = d.max_per_user,
    address = d.address,
    lat = d.lat,
    lng = d.lng,
    type = d.type::public.offer_type,
    starts_at = d.starts_at,
    ends_at = d.ends_at,
    created_by = (select l.account_user_id from public.locations l where l.id = d.location_id)
from offer_data as d
where o.id = d.id;

update public.offers
set status_reason = 'Ein Comedian ist leider erkrankt.'
where id = '5eed0000-0000-4000-8000-000000000318';
