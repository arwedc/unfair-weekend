-- Kontaktadressen offener Anträge: nur Admins und nur solange der Antrag offen ist.
select no_plan();

select tests.set_id('admin', tests.create_admin());
select tests.set_id(
  'applicant',
  tests.create_user('autotest+kontakt@example.com', '{"account_type":"standort","first_name":"Ada","last_name":"Beispiel"}')
);
select tests.set_id('other_user', tests.create_nutzer('Kontakt-Test'));

select tests.authenticate_as(tests.id('applicant'));
select tests.set_id(
  'location',
  (
    public.register_company(
      'TEST Kontakt GmbH', 'TEST Kontakt Standort', 'Teststraße 1', '48143', 'Münster', null, null, null,
      '0251 123456', null
    ) ->> 'location_id'
  )::uuid
);

select tests.authenticate_as(tests.id('admin'));
select is(
  (select contact_email from public.get_pending_location_contacts() where location_id = tests.id('location')),
  'autotest+kontakt@example.com',
  'Admin sieht Login-E-Mail des offenen Antrags'
);

select tests.authenticate_as(tests.id('other_user'));
select throws_ok(
  'select * from public.get_pending_location_contacts()',
  'P0001', 'KEIN_ZUGRIFF', 'Nutzer können Kontakt-E-Mails nicht lesen'
);

select tests.authenticate_as(tests.id('admin'));
select public.approve_location(tests.id('location'));
select is(
  (
    select count(*)::integer
    from public.get_pending_location_contacts()
    where location_id = tests.id('location')
  ),
  0,
  'freigeschaltete Anträge werden nicht mitgeliefert'
);

select * from finish();
