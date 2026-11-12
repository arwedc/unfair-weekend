-- redeem_voucher: Token/Kurzcode, eigener Standort, Einlösezeitraum
select no_plan();

select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('fremd', tests.create_location('approved'));
select tests.set_id('fremd_user', tests.location_user(tests.id('fremd')));
select tests.set_id('pending', tests.create_location('pending'));
select tests.set_id('pending_user', tests.location_user(tests.id('pending')));
select tests.set_id('mia', tests.create_nutzer('Mia'));

select tests.set_id('in_59', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '59 minutes', now() + interval '3 hours'));
select tests.set_id('in_61', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '61 minutes', now() + interval '3 hours'));
select tests.set_id('vorbei', tests.create_offer(tests.id('loc'), 'einzeltermin', now() - interval '3 hours', now() - interval '1 minute'));
select tests.set_id('zr_vor', tests.create_offer(tests.id('loc'), 'zeitraum', now() + interval '10 minutes', now() + interval '2 days'));
select tests.set_id('zr_in', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '1 day', now() + interval '2 days'));

select tests.set_id('v_59', tests.create_voucher(tests.id('in_59'), tests.id('mia'), 2));
select tests.set_id('v_61', tests.create_voucher(tests.id('in_61'), tests.id('mia')));
select tests.set_id('v_vorbei', tests.create_voucher(tests.id('vorbei'), tests.id('mia')));
select tests.set_id('v_zr_vor', tests.create_voucher(tests.id('zr_vor'), tests.id('mia')));
select tests.set_id('v_zr_in', tests.create_voucher(tests.id('zr_in'), tests.id('mia')));
select tests.set_id('v_storniert', tests.create_voucher(tests.id('zr_in'), tests.id('mia'), 1, 'storniert'));

-- Codes als postgres nachschlagen (unter RLS sieht ein fremder Standort sie nicht)
create function pg_temp.code(p_key text) returns text language sql stable security definer set search_path = '' as
  $$ select short_code from public.vouchers where id = tests.id(p_key) $$;
create function pg_temp.token(p_key text) returns text language sql stable security definer set search_path = '' as
  $$ select token from public.vouchers where id = tests.id(p_key) $$;
grant execute on function pg_temp.code(text), pg_temp.token(text) to authenticated;

select tests.authenticate_as(tests.id('loc_user'));
select is(
  (select seats from public.redeem_voucher(pg_temp.token('v_59'))),
  2, 'per QR-Token: ab 1 Std. vor Beginn einlösbar'
);
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.token('v_59')), 'P0001', 'BEREITS_EINGELOEST', 'zweimal einlösen');
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.code('v_61')), 'P0001', 'EINLOESUNG_ZU_FRUEH', 'mehr als 1 Std. vor Beginn');
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.code('v_vorbei')), 'P0001', 'EINLOESUNG_ZU_SPAET', 'nach dem Ende');
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.code('v_zr_vor')), 'P0001', 'EINLOESUNG_ZU_FRUEH', 'Zeitraum vor Beginn');
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.code('v_storniert')), 'P0001', 'CODE_NICHT_AKTIV', 'stornierter Code');
select throws_ok($$ select public.redeem_voucher('ABC-DEF') $$, 'P0001', 'CODE_NICHT_GEFUNDEN', 'unbekannter Kurzcode');
select throws_ok($$ select public.redeem_voucher('irgendwas-falsches') $$, 'P0001', 'CODE_NICHT_GEFUNDEN', 'unbekannter Token');

select is(
  (select first_name || ' ' || last_initial from public.redeem_voucher(' ' || lower(replace(pg_temp.code('v_zr_in'), '-', ' ')) || ' ')),
  'Mia A', 'Kurzcode mit Leerzeichen und klein geschrieben; Antwort mit Vorname und Initial'
);

select tests.clear_authentication();
select is((select status::text from public.vouchers where id = tests.id('v_59')), 'eingeloest', 'Status eingeloest');
select isnt((select redeemed_at from public.vouchers where id = tests.id('v_59')), null, 'redeemed_at gesetzt');
select is((select redeemed_by from public.vouchers where id = tests.id('v_59')), tests.id('loc_user'), 'redeemed_by = Standort-Konto');
select is(
  (select count(*)::int from public.events where type = 'code_eingeloest' and offer_id in (tests.id('in_59'), tests.id('zr_in'))),
  2, 'Event code_eingeloest'
);
select is((select seats_taken from public.offers where id = tests.id('in_59')), 2, 'eingelöste Plätze bleiben belegt');

-- Nur der eigene Standort
select tests.set_id('v_fremdtest', tests.create_voucher(tests.id('in_59'), tests.create_nutzer('Jonas')));
select tests.authenticate_as(tests.id('fremd_user'));
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.code('v_fremdtest')), 'P0001', 'FALSCHER_STANDORT', 'fremder Standort');

select tests.authenticate_as(tests.id('pending_user'));
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.code('v_fremdtest')), 'P0001', 'STANDORT_NICHT_FREIGESCHALTET', 'nicht freigeschalteter Standort');

select tests.authenticate_as(tests.id('mia'));
select throws_ok(format('select public.redeem_voucher(%L)', pg_temp.code('v_fremdtest')), 'P0001', 'KEIN_STANDORTKONTO', 'Nutzer kann nicht einlösen');

select * from finish();
