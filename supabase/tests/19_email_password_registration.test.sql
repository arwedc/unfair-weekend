-- E-Mail/Passwort-Registrierung: Nutzername, Alter und optionale Interessen.
select no_plan();

select tests.set_id(
  'registered_user',
  tests.create_user(
    'autotest+registration@example.com',
    jsonb_build_object(
      'username', 'TEST_user_1',
      'age', 29,
      'interests', jsonb_build_array('kochen_essen', 'kultur_events', 'ungultig')
    )
  )
);

select is(
  (select username from public.profiles where id = tests.id('registered_user')),
  'test_user_1',
  'Nutzername wird normalisiert gespeichert'
);
select is(
  (select age::integer from public.profiles where id = tests.id('registered_user')),
  29,
  'optionales Alter wird gespeichert'
);
select is(
  (select count(*)::integer from public.favorite_categories where user_id = tests.id('registered_user')),
  2,
  'gültige Interessen werden als Lieblingskategorien gespeichert'
);
select ok(not public.is_username_available('TEST_USER_1'), 'Nutzername wird ohne Beachtung der Großschreibung erkannt');
select ok(public.is_username_available('neuer_name'), 'freier Nutzername ist verfügbar');
select ok(not public.is_username_available('ab'), 'ungültiges Format ist nicht verfügbar');

select tests.authenticate_as(tests.id('registered_user'));
select is(public.get_my_account() ->> 'username', 'test_user_1', 'get_my_account gibt den Nutzernamen zurück');
select is((public.get_my_account() ->> 'age')::integer, 29, 'get_my_account gibt das Alter zurück');
select is(
  public.get_my_account() -> 'interests',
  '["kochen_essen", "kultur_events"]'::jsonb,
  'get_my_account gibt die gewählten Interessen zurück'
);

select tests.clear_authentication();
select throws_ok(
  $$ select tests.create_user('autotest+bad-username@example.com', '{"username":"bad-name"}'::jsonb) $$,
  '23514', 'UNGUELTIGER_NUTZERNAME', 'ungültiges Metadaten-Format wird abgewiesen'
);
select throws_ok(
  $$ select tests.create_user('autotest+bad-age@example.com', '{"age":0}'::jsonb) $$,
  '23514', 'UNGUELTIGES_ALTER', 'ungültiges Alter wird abgewiesen'
);
select throws_ok(
  $$ select tests.create_user('autotest+duplicate-username@example.com', '{"username":"test_user_1"}'::jsonb) $$,
  '23505', null, 'doppelte Nutzernamen werden vom Unique-Index abgefangen'
);

select * from finish();
