-- E-Mail/Passwort-Registrierung: E-Mail und Passwort; Alter und Interessen optional.
select no_plan();

select tests.set_id(
  'registered_user',
  tests.create_user(
    'autotest+registration@example.com',
    jsonb_build_object(
      'age', 29,
      'interests', jsonb_build_array('kochen_essen', 'kultur_events', 'ungultig')
    )
  )
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
select tests.authenticate_as(tests.id('registered_user'));
select ok(not (public.get_my_account() ? 'username'), 'get_my_account enthält keinen Nutzernamen');
select is((public.get_my_account() ->> 'age')::integer, 29, 'get_my_account gibt das Alter zurück');
select is(
  public.get_my_account() -> 'interests',
  '["kochen_essen", "kultur_events"]'::jsonb,
  'get_my_account gibt die gewählten Interessen zurück'
);

select tests.clear_authentication();
select throws_ok(
  $$ select tests.create_user('autotest+bad-age@example.com', '{"age":0}'::jsonb) $$,
  '23514', 'UNGUELTIGES_ALTER', 'ungültiges Alter wird abgewiesen'
);

select * from finish();
