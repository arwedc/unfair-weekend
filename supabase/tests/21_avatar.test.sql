-- Profilbild: privater Bucket avatars, update_my_avatar, get_my_account.avatar_path
select no_plan();

select is(
  (select public::text || ':' || file_size_limit::text from storage.buckets where id = 'avatars'),
  'false:2097152', 'Bucket avatars ist privat, max. 2 MB'
);

select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));

-- Hochladen nur in den eigenen Ordner
select tests.authenticate_as(tests.id('mia'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('avatars', %L) $$, tests.id('mia') || '/eins.jpg'),
  'Nutzer lädt in den eigenen Ordner hoch'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('avatars', %L) $$, tests.id('jonas') || '/fremd.jpg'),
  '42501', null, 'nicht in fremde Ordner'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', 'wurzel.jpg') $$,
  '42501', null, 'nicht ins Wurzelverzeichnis'
);

-- Setzen, lesen, entfernen
select is(public.get_my_account() ->> 'avatar_path', null, 'ohne Bild: avatar_path null');
select is(
  public.update_my_avatar(tests.id('mia') || '/eins.jpg'),
  tests.id('mia') || '/eins.jpg', 'eigenes Bild setzen'
);
select is(public.get_my_account() ->> 'avatar_path', tests.id('mia') || '/eins.jpg', 'get_my_account liefert avatar_path');
select throws_ok(
  format('select public.update_my_avatar(%L)', tests.id('mia') || '/fehlt.jpg'),
  'P0001', 'UNGUELTIGE_EINGABE', 'Datei, die es nicht gibt, abgelehnt'
);
select throws_ok(
  format('select public.update_my_avatar(%L)', tests.id('mia') || '/unter/ordner.jpg'),
  'P0001', 'UNGUELTIGE_EINGABE', 'Unterordner abgelehnt'
);

select tests.authenticate_as(tests.id('jonas'));
select throws_ok(
  format('select public.update_my_avatar(%L)', tests.id('mia') || '/eins.jpg'),
  'P0001', 'UNGUELTIGE_EINGABE', 'fremdes Bild abgelehnt'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars' and name like tests.id('mia') || '/%'),
  0, 'fremde Bilder sind nicht lesbar'
);

select tests.authenticate_as(tests.id('mia'));
select is(public.update_my_avatar(null), null, 'Bild entfernen');
select is(public.get_my_account() ->> 'avatar_path', null, 'danach wieder null');
select is(public.update_my_avatar('  '), null, 'leerer Pfad entfernt ebenfalls');

-- anon darf nicht
select tests.authenticate_as_anon();
select throws_ok(
  format('select public.update_my_avatar(%L)', tests.id('mia') || '/eins.jpg'),
  '42501', null, 'anon: keine Rechte'
);

select * from finish();
