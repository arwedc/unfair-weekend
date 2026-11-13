-- Zahlungen (Variante B): Reservieren, Bezahlen, Freigeben, Storno, Absage,
-- No-Show, Auszahlung, Rückbuchung. Stripe selbst wird hier simuliert
-- (attach/confirm/finish wie die Edge Functions mit service_role).
select no_plan();

-- Fixtures (vor dem Einschalten des Flags)
select tests.set_id('loc', tests.create_location('approved'));
select tests.set_id('loc_user', tests.location_user(tests.id('loc')));
select tests.set_id('fremd_user', tests.location_user(tests.create_location('approved')));
select tests.set_id('admin', tests.create_admin());
select tests.set_id('mia', tests.create_nutzer('Mia'));
select tests.set_id('jonas', tests.create_nutzer('Jonas'));
select tests.set_id('lea', tests.create_nutzer('Lea'));
select tests.set_id('tom', tests.create_nutzer('Tom'));

-- Kurs in 2 Tagen, 3 Plätze, max. 2 pro Person, 24,00 €
select tests.set_id('kurs', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '2 days', now() + interval '2 days 3 hours', 3, 2, 4000, 2400));
-- Kurs in 2 Std. (Storno-Frist 3 Std. schon vorbei)
select tests.set_id('bald', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '2 hours', now() + interval '4 hours', 5, 2, 4000, 2400));
-- Zeitraum, läuft
select tests.set_id('zr', tests.create_offer(tests.id('loc'), 'zeitraum', now() - interval '1 day', now() + interval '5 days', 5, 2, 3000, 1500));
-- Termin vorbei (für No-Show und Auszahlung)
select tests.set_id('vorbei', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '1 day', now() + interval '1 day 2 hours', 5, 2, 4000, 2400));
-- Gratis-Deal (unter dem Mindestbetrag)
select tests.set_id('gratis', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '2 days', now() + interval '2 days 1 hour', 5, 2, 1000, 0));

insert into public.stripe_accounts (location_id, stripe_account_id, details_submitted, charges_enabled, payouts_enabled, transfers_active)
values (tests.id('loc'), 'acct_testkochwerk', true, true, true, true);

update public.payment_settings set payments_enabled = true, commission_bps = 1500;

-- Zahlung simulieren wie die Edge Functions: PaymentIntent anhängen, Webhook bestätigt
create function tests.pay(p_booking_id uuid, p_suffix text)
returns text
language plpgsql
as $$
declare
  v_amount integer;
  v_outcome text;
begin
  select amount_cents into v_amount from public.paid_bookings where id = p_booking_id;
  if (select payment_intent_id from public.paid_bookings where id = p_booking_id) is null
    and (select status from public.paid_bookings where id = p_booking_id) = 'reserviert' then
    perform public.attach_payment_intent(p_booking_id, 'pi_' || p_suffix);
  end if;
  select outcome into v_outcome
  from public.confirm_paid_booking(p_booking_id, 'pi_' || p_suffix, 'ch_' || p_suffix, v_amount, 'EUR');
  return v_outcome;
end;
$$;

create function tests.start_booking(p_user uuid, p_offer uuid, p_seats integer)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  perform tests.authenticate_as(p_user);
  select id into v_id from public.start_paid_booking(p_offer, p_seats);
  perform tests.clear_authentication();
  return v_id;
end;
$$;

grant execute on function tests.pay(uuid, text), tests.start_booking(uuid, uuid, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 1. Reservieren: Prüfungen
-- ----------------------------------------------------------------------------
select tests.authenticate_as(tests.id('mia'));
select throws_ok(format('select public.start_paid_booking(%L, 3)', tests.id('kurs')), 'P0001', 'ZU_VIELE_PLAETZE', 'max. pro Person');
select throws_ok(format('select public.start_paid_booking(%L, 0)', tests.id('kurs')), 'P0001', 'UNGUELTIGE_PLATZANZAHL', '0 Plätze');
select throws_ok('select public.start_paid_booking(gen_random_uuid(), 1)', 'P0001', 'ANGEBOT_NICHT_GEFUNDEN', 'unbekanntes Angebot');
select throws_ok(format('select public.start_paid_booking(%L, 1)', tests.id('gratis')), 'P0001', 'BETRAG_ZU_GERING', 'unter 0,50 €');
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(format('select public.start_paid_booking(%L, 1)', tests.id('kurs')), 'P0001', 'NUR_NUTZER', 'Standorte buchen nicht');

-- Gesperrte Nutzer dürfen bezahlt buchen (keine No-Show-Sperre bei Bezahlung)
select tests.clear_authentication();
update public.profiles set blocked_until = now() + interval '5 days' where id = tests.id('tom');
select tests.authenticate_as(tests.id('tom'));
select lives_ok(format('select public.start_paid_booking(%L, 1)', tests.id('zr')), 'Sperre aus Variante A gilt nicht für bezahlte Buchungen');

-- ----------------------------------------------------------------------------
-- 2. Reservieren: Betrag, Provision, Plätze
-- ----------------------------------------------------------------------------
select tests.set_id('b_mia', tests.start_booking(tests.id('mia'), tests.id('kurs'), 2));
select is(
  (select row(status, seats, unit_price_cents, amount_cents, commission_bps, commission_cents, payout_cents)::text
   from public.paid_bookings where id = tests.id('b_mia')),
  '(reserviert,2,2400,4800,1500,720,4080)', 'Betrag und Provision aus der DB (2 × 24,00 €, 15 %)'
);
select ok(
  (select reserved_until = now() + interval '10 minutes' from public.paid_bookings where id = tests.id('b_mia')),
  'reserviert für 10 Minuten'
);
select is((select seats_taken from public.offers where id = tests.id('kurs')), 2, 'Reservierung belegt die Plätze');
select is((select location_id from public.paid_bookings where id = tests.id('b_mia')), tests.id('loc'), 'Standort steht in der Buchung');

-- Letzter Platz: Jonas will 2, nur 1 frei
select tests.authenticate_as(tests.id('jonas'));
select throws_ok(format('select public.start_paid_booking(%L, 2)', tests.id('kurs')), 'P0001', 'AUSGEBUCHT', 'nie überbuchen');
select tests.clear_authentication();
select tests.set_id('b_jonas', tests.start_booking(tests.id('jonas'), tests.id('kurs'), 1));
select tests.authenticate_as(tests.id('lea'));
select throws_ok(format('select public.start_paid_booking(%L, 1)', tests.id('kurs')), 'P0001', 'AUSGEBUCHT', 'alle Plätze reserviert');
select tests.clear_authentication();

-- Checkout neu gestartet: alte Reservierung wird freigegeben
select tests.set_id('b_mia_neu', tests.start_booking(tests.id('mia'), tests.id('kurs'), 1));
select is((select status::text from public.paid_bookings where id = tests.id('b_mia')), 'abgelaufen', 'alte Reservierung freigegeben');
select is((select seats_taken from public.offers where id = tests.id('kurs')), 2, 'Plätze: 1 (Jonas) + 1 (Mia neu)');
select is(
  (select count(*)::int from public.paid_bookings where offer_id = tests.id('kurs') and user_id = tests.id('mia') and status = 'reserviert'),
  1, 'höchstens eine offene Reservierung pro Nutzer und Angebot'
);

-- RLS: Nutzer sieht nur eigene, Standort seine, fremder Standort nichts
select tests.authenticate_as(tests.id('jonas'));
select is((select count(*)::int from public.paid_bookings), 1, 'Nutzer sieht nur eigene Buchungen');
select tests.authenticate_as(tests.id('loc_user'));
select ok((select count(*)::int from public.paid_bookings) >= 3, 'Standort sieht Buchungen seiner Angebote');
select tests.authenticate_as(tests.id('fremd_user'));
select is((select count(*)::int from public.paid_bookings), 0, 'fremder Standort sieht nichts');
select tests.authenticate_as(tests.id('admin'));
select ok((select count(*)::int from public.paid_bookings) >= 3, 'Admin sieht alle');
select tests.clear_authentication();

-- ----------------------------------------------------------------------------
-- 3. Bezahlen (Webhook): Code wird ausgegeben, doppelt ist harmlos
-- ----------------------------------------------------------------------------
select is(tests.pay(tests.id('b_jonas'), 'jonas1'), 'bestaetigt', 'Zahlung bestätigt');
select is((select status::text from public.paid_bookings where id = tests.id('b_jonas')), 'bezahlt', 'Buchung bezahlt');
select tests.set_id('v_jonas', (select voucher_id from public.paid_bookings where id = tests.id('b_jonas')));
select is((select status::text from public.vouchers where id = tests.id('v_jonas')), 'aktiv', 'normaler aktiver Code');
select is((select seats from public.vouchers where id = tests.id('v_jonas')), 1, 'Code mit den gebuchten Plätzen');
select is((select seats_taken from public.offers where id = tests.id('kurs')), 2, 'keine doppelte Zählung der Plätze');
select ok(
  (select payout_due_at = (select ends_at from public.offers where id = tests.id('kurs')) + interval '24 hours'
   from public.paid_bookings where id = tests.id('b_jonas')),
  'Auszahlung fällig: Ende + 24 Std.'
);
select is(
  (select count(*)::int from public.events where type = 'code_geholt' and voucher_id = tests.id('v_jonas')),
  1, 'Event code_geholt'
);
select is(tests.pay(tests.id('b_jonas'), 'jonas1'), 'bereits_verarbeitet', 'doppelter Webhook ändert nichts');
select is((select count(*)::int from public.vouchers where offer_id = tests.id('kurs') and user_id = tests.id('jonas')), 1, 'nur ein Code');
select lives_ok(format('select public.attach_payment_intent(%L, ''pi_mianeu'')', tests.id('b_mia_neu')), 'PaymentIntent anhängen');
select lives_ok(format('select public.attach_payment_intent(%L, ''pi_mianeu'')', tests.id('b_mia_neu')), 'anhängen ist idempotent');
select throws_ok(
  format('select public.attach_payment_intent(%L, ''pi_anderer'')', tests.id('b_mia_neu')),
  'P0001', 'UNGUELTIGE_EINGABE', 'kein zweiter PaymentIntent'
);
select throws_ok(
  format('select public.confirm_paid_booking(%L, ''pi_jonas1'', ''ch_x'', 2400, ''eur'')', tests.id('b_mia_neu')),
  'P0001', 'BUCHUNG_NICHT_GEFUNDEN', 'fremder PaymentIntent passt nicht zur Buchung'
);
select throws_ok(
  format('select public.confirm_paid_booking(%L, ''pi_mianeu'', ''ch_mianeu'', 100, ''eur'')', tests.id('b_mia_neu')),
  'P0001', 'UNGUELTIGE_EINGABE', 'falscher Betrag wird abgelehnt'
);

-- Einlösen wie bisher (redeem_voucher), Buchung übernimmt den Status
-- (Kurs beginnt erst in 2 Tagen → zum Test den Termin vorziehen)
update public.offers set starts_at = now() + interval '30 minutes', ends_at = now() + interval '2 hours' where id = tests.id('kurs');
select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(format('select public.redeem_voucher(%L)', (select short_code from public.vouchers where id = tests.id('v_jonas'))), 'bezahlter Code wird normal eingelöst');
select tests.clear_authentication();
select is((select status::text from public.paid_bookings where id = tests.id('b_jonas')), 'eingeloest', 'Buchung eingeloest');

-- ----------------------------------------------------------------------------
-- 4. Reservierung verfällt (Cron), Zahlung kommt zu spät
-- ----------------------------------------------------------------------------
-- Zeitraum: Lea reserviert 2 Plätze, Timer läuft ab
select tests.set_id('b_lea', tests.start_booking(tests.id('lea'), tests.id('zr'), 2));
select lives_ok(format('select public.attach_payment_intent(%L, ''pi_lea1'')', tests.id('b_lea')), 'PI angehängt');
update public.paid_bookings set reserved_until = now() - interval '1 second' where id = tests.id('b_lea');
select ok(private.release_expired_reservations() >= 1, 'Cron gibt abgelaufene Reservierungen frei');
select is((select status::text from public.paid_bookings where id = tests.id('b_lea')), 'abgelaufen', 'Status abgelaufen');
select is((select seats_taken from public.offers where id = tests.id('zr')), 1, 'Plätze zurück (nur Toms Reservierung bleibt)');
select is(
  (select count(*)::int from public.payment_jobs where booking_id = tests.id('b_lea') and kind = 'pi_abbrechen'),
  1, 'PaymentIntent wird abgebrochen (Job)'
);
select throws_ok(format('select public.attach_payment_intent(%L, ''pi_lea1'')', tests.id('b_lea')), 'P0001', 'RESERVIERUNG_ABGELAUFEN', 'abgelaufene Reservierung nimmt keinen PI mehr');

-- Zahlung kommt trotzdem durch, Platz ist noch frei → bestätigt
select is(tests.pay(tests.id('b_lea'), 'lea1'), 'bestaetigt_nachtraeglich', 'verspätete Zahlung, Platz frei → bestätigt');
select is((select status::text from public.paid_bookings where id = tests.id('b_lea')), 'bezahlt', 'Buchung bezahlt');
select is((select seats_taken from public.offers where id = tests.id('zr')), 3, 'Plätze wieder belegt');

-- Zahlung kommt zu spät, Platz ist weg → Vollerstattung
select tests.set_id('kurs2', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '3 days', now() + interval '3 days 2 hours', 1, 1, 4000, 2400));
select tests.set_id('b_mia_spaet', tests.start_booking(tests.id('mia'), tests.id('kurs2'), 1));
select lives_ok(format('select public.attach_payment_intent(%L, ''pi_miaspaet'')', tests.id('b_mia_spaet')), 'PI angehängt');
update public.paid_bookings set reserved_until = now() - interval '1 second' where id = tests.id('b_mia_spaet');
select private.release_expired_reservations();
select tests.set_id('b_lea_kurs2', tests.start_booking(tests.id('lea'), tests.id('kurs2'), 1));
select is(tests.pay(tests.id('b_lea_kurs2'), 'leakurs2'), 'bestaetigt', 'Lea bekommt den freien Platz');
select is(tests.pay(tests.id('b_mia_spaet'), 'miaspaet'), 'erstattung', 'verspätete Zahlung, Platz weg → Erstattung');
select is(
  (select row(status, cancel_reason)::text from public.paid_bookings where id = tests.id('b_mia_spaet')),
  '(storniert,zahlung_zu_spaet)', 'Buchung storniert, Grund zahlung_zu_spaet'
);
select is(
  (select row(amount_cents, reason, status)::text from public.payment_refunds where booking_id = tests.id('b_mia_spaet')),
  '(2400,zahlung_zu_spaet,offen)', 'Vollerstattung vorgemerkt'
);
select is((select seats_taken from public.offers where id = tests.id('kurs2')), 1, 'nicht überbucht');
select is((select count(*)::int from public.vouchers where offer_id = tests.id('kurs2')), 1, 'kein zweiter Code');

-- ----------------------------------------------------------------------------
-- 5. Storno durch den Nutzer
-- ----------------------------------------------------------------------------
-- Abbruch im PaymentSheet: Reservierung sofort frei
select tests.set_id('b_tom_kurs2abbruch', tests.start_booking(tests.id('tom'), tests.id('bald'), 1));
select tests.authenticate_as(tests.id('tom'));
select is(
  (select status::text from public.cancel_paid_booking(tests.id('b_tom_kurs2abbruch'))),
  'abgelaufen', 'Abbruch gibt die Reservierung frei'
);
select tests.authenticate_as(tests.id('mia'));
select throws_ok(format('select public.cancel_paid_booking(%L)', tests.id('b_lea')), 'P0001', 'BUCHUNG_NICHT_GEFUNDEN', 'fremde Buchung');
select tests.clear_authentication();
select is((select seats_taken from public.offers where id = tests.id('bald')), 0, 'Plätze zurück');

-- Storno vor der Frist (Zeitraum, nicht eingelöst): Erstattung
select tests.authenticate_as(tests.id('lea'));
select is(
  (select row(status, refund_amount_cents)::text from public.cancel_paid_booking(tests.id('b_lea'))),
  '(storniert,3000)', 'Storno vor Ende des Zeitraums → Erstattung 30,00 €'
);
select tests.clear_authentication();
select is((select status::text from public.vouchers where id = (select voucher_id from public.paid_bookings where id = tests.id('b_lea'))), 'storniert', 'Code storniert');
select is((select seats_taken from public.offers where id = tests.id('zr')), 1, 'Plätze zurück');
select is((select count(*)::int from public.payment_jobs where booking_id = tests.id('b_lea') and kind = 'erstatten'), 1, 'Erstattungs-Job angelegt');

-- Storno nach der Frist (Einzeltermin in 2 Std., Frist 3 Std.): abgelehnt
select tests.set_id('b_mia_bald', tests.start_booking(tests.id('mia'), tests.id('bald'), 1));
select is(tests.pay(tests.id('b_mia_bald'), 'miabald'), 'bestaetigt', 'bezahlt');
select tests.authenticate_as(tests.id('mia'));
select throws_ok(format('select public.cancel_paid_booking(%L)', tests.id('b_mia_bald')), 'P0001', 'FRIST_ABGELAUFEN', 'Storno nach der Frist abgelehnt');
select tests.clear_authentication();
select is((select count(*)::int from public.payment_refunds where booking_id = tests.id('b_mia_bald')), 0, 'keine Erstattung nach der Frist');

-- Storno über das alte cancel_voucher löst ebenfalls die Erstattung aus
select tests.set_id('kurs3', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '3 days', now() + interval '3 days 2 hours', 5, 2, 4000, 2400));
select tests.set_id('b_jonas3', tests.start_booking(tests.id('jonas'), tests.id('kurs3'), 1));
select is(tests.pay(tests.id('b_jonas3'), 'jonas3'), 'bestaetigt', 'bezahlt');
select tests.authenticate_as(tests.id('jonas'));
select lives_ok(format('select public.cancel_voucher(%L)', (select voucher_id from public.paid_bookings where id = tests.id('b_jonas3'))), 'cancel_voucher wie bisher');
select tests.clear_authentication();
select is((select reason::text from public.payment_refunds where booking_id = tests.id('b_jonas3')), 'nutzer', 'Erstattung auch über cancel_voucher');

-- ----------------------------------------------------------------------------
-- 6. Absage durch das Unternehmen: alle bezahlten Buchungen erstattet, Push wie bisher
-- ----------------------------------------------------------------------------
select tests.set_id('kurs4', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '4 days', now() + interval '4 days 2 hours', 5, 2, 4000, 2400));
select tests.set_id('b4_mia', tests.start_booking(tests.id('mia'), tests.id('kurs4'), 2));
select tests.set_id('b4_lea', tests.start_booking(tests.id('lea'), tests.id('kurs4'), 1));
select tests.set_id('b4_jonas', tests.start_booking(tests.id('jonas'), tests.id('kurs4'), 1));
select is(tests.pay(tests.id('b4_mia'), 'b4mia'), 'bestaetigt', 'Mia bezahlt');
select is(tests.pay(tests.id('b4_lea'), 'b4lea'), 'bestaetigt', 'Lea bezahlt');
-- Jonas bezahlt noch nicht (Reservierung offen)
select tests.authenticate_as(tests.id('loc_user'));
select is(((public.cancel_offer(tests.id('kurs4'), 'Krank')) ->> 'cancelled_vouchers')::int, 2, 'Absage storniert die bezahlten Codes');
select tests.clear_authentication();
select is(
  (select array_agg(reason::text || ':' || amount_cents order by amount_cents) from public.payment_refunds where booking_id in (tests.id('b4_mia'), tests.id('b4_lea'))),
  array['angebot_abgesagt:2400', 'angebot_abgesagt:4800'], 'alle voll erstattet'
);
select is(
  (select count(*)::int from public.notification_outbox where type = 'angebot_abgesagt' and offer_id = tests.id('kurs4')),
  2, 'Push an die Inhaber über die bestehende Outbox'
);
select private.release_expired_reservations();
select is((select status::text from public.paid_bookings where id = tests.id('b4_jonas')), 'abgelaufen', 'offene Reservierung des abgesagten Angebots freigegeben');
select is((select seats_taken from public.offers where id = tests.id('kurs4')), 0, 'alle Plätze zurück');
select is(tests.pay(tests.id('b4_jonas'), 'b4jonas'), 'erstattung', 'Zahlung nach der Absage → Erstattung');

-- ----------------------------------------------------------------------------
-- 7. Kontolöschung: vor der Frist Erstattung, danach nicht
-- ----------------------------------------------------------------------------
select tests.set_id('kurs5', tests.create_offer(tests.id('loc'), 'einzeltermin', now() + interval '3 days', now() + interval '3 days 2 hours', 5, 2, 4000, 2400));
select tests.set_id('b5_tom', tests.start_booking(tests.id('tom'), tests.id('kurs5'), 1));
select is(tests.pay(tests.id('b5_tom'), 'b5tom'), 'bestaetigt', 'Tom bezahlt (vor der Frist)');
select tests.set_id('b5_tom_bald', tests.start_booking(tests.id('tom'), tests.id('bald'), 1));
select is(tests.pay(tests.id('b5_tom_bald'), 'b5tombald'), 'bestaetigt', 'Tom bezahlt (nach der Frist)');
select tests.authenticate_as(tests.id('tom'));
select lives_ok('select public.delete_my_account()', 'Konto gelöscht');
select tests.clear_authentication();
select is((select reason::text from public.payment_refunds where booking_id = tests.id('b5_tom')), 'konto_geloescht', 'vor der Frist erstattet');
select is((select count(*)::int from public.payment_refunds where booking_id = tests.id('b5_tom_bald')), 0, 'nach der Frist keine Erstattung');
select is(
  (select row(status, cancel_reason, user_id is null)::text from public.paid_bookings where id = tests.id('b5_tom_bald')),
  '(storniert,konto_geloescht,t)', 'Buchung bleibt (für die Auszahlung), ohne Personenbezug'
);

-- ----------------------------------------------------------------------------
-- 8. No-Show: keine Sperre, keine Erstattung
-- ----------------------------------------------------------------------------
select tests.set_id('b_lea_vorbei', tests.start_booking(tests.id('lea'), tests.id('vorbei'), 1));
select is(tests.pay(tests.id('b_lea_vorbei'), 'leavorbei'), 'bestaetigt', 'Lea bezahlt');
update public.offers set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = tests.id('vorbei');
select tests.set_id('v_lea_vorbei', (select voucher_id from public.paid_bookings where id = tests.id('b_lea_vorbei')));
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(format('select public.mark_no_show(%L)', tests.id('v_lea_vorbei')), 'P0001', 'NO_SHOW_BEZAHLT', 'mark_no_show auf bezahlte Codes gesperrt');
select tests.authenticate_as(tests.id('fremd_user'));
select throws_ok(format('select public.mark_paid_no_show(%L)', tests.id('v_lea_vorbei')), 'P0001', 'CODE_NICHT_GEFUNDEN', 'fremder Standort');
select tests.authenticate_as(tests.id('loc_user'));
select is((select status::text from public.mark_paid_no_show(tests.id('v_lea_vorbei'))), 'no_show', 'mark_paid_no_show');
select tests.clear_authentication();
select is((select no_show_count from public.profiles where id = tests.id('lea')), 0, 'kein No-Show-Zähler');
select is((select blocked_until from public.profiles where id = tests.id('lea')), null, 'keine Sperre');
select is((select status::text from public.paid_bookings where id = tests.id('b_lea_vorbei')), 'no_show', 'Buchung no_show');
select is((select count(*)::int from public.payment_refunds where booking_id = tests.id('b_lea_vorbei')), 0, 'keine Erstattung');
-- Gratis-Codes (Variante A) laufen weiter über mark_no_show
select tests.clear_authentication();
update public.payment_settings set payments_enabled = false;
select tests.set_id('v_gratis', tests.create_voucher(tests.id('vorbei'), tests.id('jonas')));
update public.payment_settings set payments_enabled = true;
select tests.authenticate_as(tests.id('loc_user'));
select throws_ok(
  format('select public.mark_paid_no_show(%L)', tests.id('v_gratis')),
  'P0001', 'CODE_NICHT_GEFUNDEN', 'mark_paid_no_show nur für bezahlte Codes'
);
select is((select user_blocked from public.mark_no_show(tests.id('v_gratis'))), false, 'Gratis-Code: mark_no_show wie bisher');
select tests.clear_authentication();
select is((select no_show_count from public.profiles where id = tests.id('jonas')), 1, 'Gratis-Code zählt weiter');
select tests.authenticate_as(tests.id('loc_user'));

-- Teilnehmerliste mit Bezahlstatus
select is(
  (select row(is_paid, booking_status, amount_cents)::text from public.get_offer_participants_paid(tests.id('vorbei')) where voucher_id = tests.id('v_lea_vorbei')),
  '(t,no_show,2400)', 'Teilnehmerliste zeigt Bezahlstatus'
);
select tests.authenticate_as(tests.id('fremd_user'));
select throws_ok(format('select public.get_offer_participants_paid(%L)', tests.id('vorbei')), 'P0001', 'ANGEBOT_NICHT_GEFUNDEN', 'nur eigener Standort');

-- ----------------------------------------------------------------------------
-- 9. Auszahlung nach dem Termin (Worker simuliert)
-- ----------------------------------------------------------------------------
select tests.clear_authentication();
update public.paid_bookings set payout_due_at = now() - interval '1 minute' where id in (tests.id('b_lea_vorbei'), tests.id('b5_tom_bald'));
select is(private.enqueue_due_payouts(), 2, 'fällige Auszahlungen vorgemerkt (No-Show und Kontolöschung nach Frist)');
select is(private.enqueue_due_payouts(), 0, 'nicht doppelt');
select is(
  (select count(*)::int from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b_mia_bald')),
  0, 'noch nicht fällige Buchung wird nicht ausgezahlt'
);
select is(
  (select row(kind, payout_cents, destination_account_id, charge_id)::text
   from public.claim_payment_jobs(10, tests.id('b_lea_vorbei'))),
  '(auszahlen,2040,acct_testkochwerk,ch_leavorbei)', 'Worker bekommt Betrag minus Provision, Konto und source_transaction'
);
select is((select status::text from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b_lea_vorbei')), 'laeuft', 'Job läuft');
select lives_ok(
  format('select public.finish_payment_job(%s, true, ''tr_leavorbei'')', (select id from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b_lea_vorbei'))),
  'Transfer verbucht'
);
select is((select status::text from public.paid_bookings where id = tests.id('b_lea_vorbei')), 'ausgezahlt', 'Buchung ausgezahlt');
select is(
  (select row(amount_cents, source_charge_id, status)::text from public.payment_transfers where booking_id = tests.id('b_lea_vorbei')),
  '(2040,ch_leavorbei,ueberwiesen)', 'Transfer mit source_transaction'
);
select lives_ok(
  format('select public.finish_payment_job(%s, true, ''tr_leavorbei'')', (select id from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b_lea_vorbei'))),
  'doppelte Rückmeldung ist harmlos'
);

-- Fehlschlag: Wiederholung mit Backoff, nach 5 Versuchen endgültig
select is((select kind::text from public.claim_payment_jobs(10, tests.id('b5_tom_bald'))), 'auszahlen', 'zweiter Auszahlungs-Job');
select lives_ok(
  format('select public.finish_payment_job(%s, false, null, null, ''Netzwerk'')', (select id from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b5_tom_bald'))),
  'Fehler gemeldet'
);
select is(
  (select row(status, attempts, last_error)::text from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b5_tom_bald')),
  '(offen,1,Netzwerk)', 'Job wartet auf Wiederholung'
);
select ok(
  (select next_attempt_at > now() from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b5_tom_bald')),
  'mit Backoff'
);

-- Absage nach der Auszahlung: Erstattung und Transfer zurückholen
select tests.set_id('b_mia_vorbei', tests.start_booking(tests.id('mia'), tests.id('zr'), 1));
select is(tests.pay(tests.id('b_mia_vorbei'), 'miavorbei'), 'bestaetigt', 'Mia bezahlt Zeitraum');
update public.paid_bookings set payout_due_at = now() - interval '1 minute' where id = tests.id('b_mia_vorbei');
select private.enqueue_due_payouts();
select is((select kind::text from public.claim_payment_jobs(10, tests.id('b_mia_vorbei'))), 'auszahlen', 'Auszahlung läuft');
select public.finish_payment_job((select id from public.payment_jobs where kind = 'auszahlen' and booking_id = tests.id('b_mia_vorbei')), true, 'tr_miavorbei');
select tests.authenticate_as(tests.id('loc_user'));
select lives_ok(format('select public.cancel_offer(%L)', tests.id('zr')), 'Absage nach der Auszahlung');
select tests.clear_authentication();
select is((select status::text from public.payment_transfers where booking_id = tests.id('b_mia_vorbei')), 'zurueckholen', 'Transfer wird zurückgeholt');
select is(
  (select count(*)::int from public.payment_jobs where booking_id = tests.id('b_mia_vorbei') and kind in ('erstatten', 'auszahlung_zurueckholen')),
  2, 'Jobs: Erstattung und Rückholung'
);

-- ----------------------------------------------------------------------------
-- 10. Erstattung über den Worker, Stand aus dem Webhook
-- ----------------------------------------------------------------------------
select is((select refund_amount_cents from public.claim_payment_jobs(10, tests.id('b_lea')) where kind = 'erstatten'), 3000, 'Worker erstattet den vollen Betrag');
select lives_ok(
  format('select public.finish_payment_job(%s, true, ''re_lea1'', ''pending'')', (select id from public.payment_jobs where kind = 'erstatten' and booking_id = tests.id('b_lea'))),
  'Erstattung angefragt'
);
select is((select status::text from public.payment_refunds where booking_id = tests.id('b_lea')), 'angefragt', 'Status angefragt');
select lives_ok('select public.update_refund_status(''re_lea1'', ''succeeded'')', 'Webhook: Erstattung fertig');
select is(
  (select row(r.status, b.status)::text from public.payment_refunds r join public.paid_bookings b on b.id = r.booking_id where r.booking_id = tests.id('b_lea')),
  '(erstattet,erstattet)', 'Erstattung und Buchung erstattet'
);

-- Abgesagte Buchung: Auszahlungs-Job entfällt, wenn eine Erstattung existiert
select is(
  (select count(*)::int from public.paid_bookings b
   where b.id = tests.id('b4_mia') and b.status = 'storniert'),
  1, 'abgesagte Buchung ist storniert'
);
update public.paid_bookings set payout_due_at = now() - interval '1 minute' where id = tests.id('b4_mia');
select is(private.enqueue_due_payouts(), 0, 'erstattete Buchungen werden nie ausgezahlt');

-- ----------------------------------------------------------------------------
-- 11. Rückbuchung (Dispute)
-- ----------------------------------------------------------------------------
select is(
  (select booking_id from public.record_dispute('dp_test1', 'ch_leavorbei', 'pi_leavorbei', 2400, 'fraudulent', 'needs_response', now() + interval '7 days', false)),
  tests.id('b_lea_vorbei'), 'Dispute der Buchung zugeordnet'
);
select is(
  (select row(stripe_status, closed_at is null)::text from public.record_dispute('dp_test1', 'ch_leavorbei', null, 2400, 'fraudulent', 'won', null, true)),
  '(won,f)', 'Dispute aktualisiert und geschlossen'
);
select is((select count(*)::int from public.payment_disputes where stripe_dispute_id = 'dp_test1'), 1, 'nur ein Eintrag');
select tests.authenticate_as(tests.id('loc_user'));
select is((select count(*)::int from public.payment_disputes), 0, 'Standort sieht keine Disputes');
select tests.authenticate_as(tests.id('admin'));
select is((select count(*)::int from public.payment_disputes where stripe_dispute_id = 'dp_test1'), 1, 'Admin sieht Disputes');

-- ----------------------------------------------------------------------------
-- 12. Übersicht für Standorte und Admin
-- ----------------------------------------------------------------------------
select tests.authenticate_as(tests.id('loc_user'));
select is(
  (select row(amount_cents, commission_cents, payout_cents, status, transfer_status)::text
   from public.get_location_bookings() where booking_id = tests.id('b_lea_vorbei')),
  '(2400,360,2040,ausgezahlt,ueberwiesen)', 'Standort: Brutto, Provision, Netto, Auszahlung'
);
select is(
  (select count(*)::int from public.get_location_bookings() where status in ('reserviert', 'abgelaufen')),
  0, 'ohne offene bzw. verfallene Reservierungen'
);
select tests.authenticate_as(tests.id('fremd_user'));
select is((select count(*)::int from public.get_location_bookings()), 0, 'fremder Standort sieht nichts');
select tests.authenticate_as(tests.id('mia'));
select throws_ok('select public.get_location_bookings()', 'P0001', 'KEIN_STANDORTKONTO', 'Nutzer haben keine Übersicht');
select tests.authenticate_as(tests.id('admin'));
select ok((select count(*)::int from public.get_location_bookings()) >= 5, 'Admin sieht alle Buchungen');
select ok(
  (public.get_admin_payment_metrics() -> 'totals' ->> 'gross_cents')::int >= 2400,
  'Admin-Kennzahlen: Umsatz'
);
select ok(
  (public.get_admin_payment_metrics() -> 'totals' ->> 'commission_cents')::int >= 360,
  'Admin-Kennzahlen: Provision der ausgezahlten Buchungen'
);

select * from finish();
