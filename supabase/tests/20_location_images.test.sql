-- Standortbilder: bis zu fünf Pfade, erstes Bild als Hauptbild und gemeinsame Aktivitätsgalerie
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('other', tests.create_location('approved'));
select tests.set_id('other_user', tests.location_user(tests.id('other')));

select tests.authenticate_as(tests.id('loc_user'));
insert into storage.objects (bucket_id, name) values
  ('offer-images', tests.id('loc') || '/one.jpg'),
  ('offer-images', tests.id('loc') || '/two.jpg'),
  ('offer-images', tests.id('loc') || '/three.jpg'),
  ('offer-images', tests.id('loc') || '/four.jpg'),
  ('offer-images', tests.id('loc') || '/five.jpg');

select is(
  public.update_my_location_images(array[
    tests.id('loc') || '/one.jpg', tests.id('loc') || '/two.jpg',
    tests.id('loc') || '/three.jpg', tests.id('loc') || '/four.jpg',
    tests.id('loc') || '/five.jpg'
  ]),
  array[
    tests.id('loc') || '/one.jpg', tests.id('loc') || '/two.jpg',
    tests.id('loc') || '/three.jpg', tests.id('loc') || '/four.jpg',
    tests.id('loc') || '/five.jpg'
  ],
  'speichert fünf Bilder in Reihenfolge'
);
select throws_ok(
  format('select public.update_my_location_images(array[%L,%L,%L,%L,%L,%L])',
    tests.id('loc') || '/one.jpg', tests.id('loc') || '/two.jpg', tests.id('loc') || '/three.jpg',
    tests.id('loc') || '/four.jpg', tests.id('loc') || '/five.jpg', tests.id('loc') || '/six.jpg'),
  'P0001', 'BILDER_UNGUELTIG', 'mehr als fünf Bilder abgelehnt'
);
select throws_ok(
  format('select public.update_my_location_images(array[%L])', tests.id('other') || '/foreign.jpg'),
  'P0001', 'BILDER_UNGUELTIG', 'fremder Standortpfad abgelehnt'
);
select throws_ok(
  format('select public.update_my_location_images(array[%L,%L])',
    tests.id('loc') || '/one.jpg', tests.id('loc') || '/one.jpg'),
  'P0001', 'BILDER_UNGUELTIG', 'doppelte Bilder abgelehnt'
);

select tests.clear_authentication();
update public.payment_settings set payments_enabled = false;
select tests.set_id('offer', tests.create_offer(tests.id('loc')));
select tests.authenticate_as_anon();
select is(
  (select image_paths from public.get_offer(tests.id('offer'))),
  array[
    tests.id('loc') || '/one.jpg', tests.id('loc') || '/two.jpg',
    tests.id('loc') || '/three.jpg', tests.id('loc') || '/four.jpg',
    tests.id('loc') || '/five.jpg'
  ],
  'Aktivität liefert die Galerie des Standorts'
);
select is(
  (select cover_image_path from public.list_offers() where id = tests.id('offer')),
  tests.id('loc') || '/one.jpg',
  'erstes Standortbild ist das Hauptbild der Aktivität'
);

select * from finish();
