-- Storage: Buckets und Ordner-Policies
select no_plan();

select is(
  (select array_agg(id || ':' || public::text order by id) from storage.buckets where id in ('offer-images', 'company-logos')),
  array['company-logos:true', 'offer-images:true'], 'beide Buckets existieren und sind öffentlich'
);
select is(
  (select file_size_limit from storage.buckets where id = 'offer-images'),
  5242880::bigint, 'Angebotsbilder: max. 5 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'company-logos'),
  array['image/jpeg', 'image/png', 'image/webp'], 'Logos: nur JPEG, PNG, WebP'
);

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('company', (select company_id from public.locations where id = tests.id('loc')));
select tests.set_id('fremd', tests.create_location('approved'));
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('admin', tests.create_admin());

select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('offer-images', %L) $$, tests.id('loc') || '/autotest.jpg'),
  'Standort lädt in den eigenen Ordner hoch'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('offer-images', %L) $$, tests.id('fremd') || '/autotest.jpg'),
  '42501', null, 'nicht in fremde Standort-Ordner'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('offer-images', 'autotest.jpg') $$,
  '42501', null, 'nicht ins Wurzelverzeichnis'
);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('company-logos', %L) $$, tests.id('company') || '/logo.png'),
  'Logo in den Ordner des eigenen Unternehmens'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('company-logos', %L) $$, tests.id('loc') || '/logo.png'),
  '42501', null, 'Logo nicht in den Standort-Ordner'
);

select tests.authenticate_as(tests.id('mia'));
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('offer-images', %L) $$, tests.id('loc') || '/mia.jpg'),
  '42501', null, 'Nutzer können keine Angebotsbilder hochladen'
);

select tests.authenticate_as(tests.id('admin'));
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('offer-images', %L) $$, tests.id('fremd') || '/admin.jpg'),
  'Admin darf überall hochladen'
);

select * from finish();
