-- ============================================================================
-- Zahlungen (Variante B), Teil 2: Regeln
--
-- Neue Funktionen, drei neue Trigger auf bestehenden Tabellen (vouchers 2×,
-- offers 1×) und ein Cron-Job. Bestehende Funktionen von Variante A bleiben
-- unverändert. Bei payments_enabled = false tun die Trigger nichts, was
-- Variante A betrifft (der Sync-Trigger reagiert nur auf Codes mit Buchung).
--
-- Sperrreihenfolge wie in Variante A: Angebot (offers) → Code (vouchers) →
-- Buchung (paid_bookings) → Profile.
--
-- Session-Variablen (nur innerhalb der Transaktion, set_config(..., true)):
--   unfair.paid_booking  Code-Ausgabe aus confirm_paid_booking (Flag-Sperre)
--   unfair.paid_no_show  No-Show aus mark_paid_no_show (No-Show-Weiche)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helfer
-- ----------------------------------------------------------------------------

-- Die zentrale Stelle für das Flag (gleiche Regel: bookingMode() in packages/shared)
create function private.payments_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.payments_enabled from public.payment_settings s where s.id), false);
$$;

create function private.get_payment_settings()
returns public.payment_settings
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.payment_settings where id;
$$;

-- Provision in Cent, kaufmännisch gerundet. Gleiche Formel: commissionCents() in packages/shared.
create function private.commission_cents(p_amount_cents integer, p_commission_bps integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select ((p_amount_cents::bigint * p_commission_bps + 5000) / 10000)::integer;
$$;

-- Kann der Standort bezahlte Buchungen annehmen? (Stripe-Konto bereit)
create function private.payout_account_ready(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.is_ready from public.stripe_accounts a where a.location_id = p_location_id),
    false
  );
$$;

-- Fälligkeit der Auszahlung: Ende + Verzug (Zeitraum: Einlösung zieht vor, siehe Sync-Trigger)
create function private.payout_due_at(p_offer public.offers)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select p_offer.ends_at + make_interval(hours => (private.get_payment_settings()).payout_delay_hours);
$$;

-- Job für den Stripe-Worker anlegen (je Art und Buchung höchstens einer)
create function private.enqueue_payment_job(p_kind public.payment_job_kind, p_booking_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.payment_jobs (kind, booking_id)
  values (p_kind, p_booking_id)
  on conflict (kind, booking_id) do nothing;
$$;

-- Vollerstattung vormerken (Erstattung + Job). Idempotent.
create function private.enqueue_refund(
  p_booking public.paid_bookings,
  p_reason public.booking_cancel_reason
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payment_refunds (booking_id, amount_cents, reason)
  values (p_booking.id, p_booking.amount_cents, p_reason)
  on conflict (booking_id) do nothing;
  perform private.enqueue_payment_job('erstatten', p_booking.id);
end;
$$;

-- Reservierung freigeben. Voraussetzung: Aufrufer hält die Sperre auf dem Angebot
-- und die Buchung steht auf reserviert.
create function private.release_reservation(p_booking public.paid_bookings)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.paid_bookings b
  set status = 'abgelaufen', expired_at = now()
  where b.id = p_booking.id and b.status = 'reserviert';
  if not found then
    return;
  end if;

  update public.offers o set seats_taken = o.seats_taken - p_booking.seats where o.id = p_booking.offer_id;

  if p_booking.payment_intent_id is not null then
    perform private.enqueue_payment_job('pi_abbrechen', p_booking.id);
  end if;
end;
$$;

-- Code für eine bezahlte Buchung ausgeben. Gibt null zurück, wenn der Nutzer
-- inzwischen schon einen aktiven Code für das Angebot hat.
-- Voraussetzung: Aufrufer hält die Sperre auf dem Angebot.
create function private.issue_paid_voucher(p_booking public.paid_bookings)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voucher_id uuid;
  v_attempt integer := 0;
begin
  if p_booking.user_id is null then
    return null;
  end if;
  if exists (
    select 1 from public.vouchers v
    where v.offer_id = p_booking.offer_id and v.user_id = p_booking.user_id and v.status = 'aktiv'
  ) then
    return null;
  end if;

  -- Erlaubt die Code-Ausgabe trotz Flag-Sperre (Trigger guard_voucher_insert)
  perform set_config('unfair.paid_booking', p_booking.id::text, true);
  loop
    begin
      insert into public.vouchers (offer_id, user_id, seats, token, short_code)
      values (
        p_booking.offer_id, p_booking.user_id, p_booking.seats,
        private.generate_token(), private.generate_short_code()
      )
      returning id into v_voucher_id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
  perform set_config('unfair.paid_booking', '', true);

  return v_voucher_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Trigger 1 (vouchers, BEFORE INSERT): Bei Flag an gibt es Codes nur noch
-- aus dem Bezahlablauf. Blockiert damit claim_voucher, ohne es zu ändern.
-- ----------------------------------------------------------------------------
create function private.guard_voucher_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.payments_enabled() then
    return new;
  end if;
  if coalesce(current_setting('unfair.paid_booking', true), '') <> '' then
    return new;
  end if;
  perform private.raise_error(
    'ZAHLUNG_ERFORDERLICH',
    'Dieses Angebot kannst du nur noch mit Bezahlung in der App buchen.'
  );
  return null;
end;
$$;

create trigger vouchers_guard_payments
  before insert on public.vouchers
  for each row execute function private.guard_voucher_insert();

-- ----------------------------------------------------------------------------
-- Trigger 2 (vouchers, AFTER UPDATE OF status): Codes mit bezahlter Buchung
--   - übernehmen eingeloest/no_show in die Buchung
--   - stornierte Codes → Buchung storniert, Erstattung vormerken
--   - mark_no_show auf bezahlte Codes ist gesperrt (keine No-Show-Sperre)
-- Codes ohne Buchung (Variante A) bleiben unberührt.
-- ----------------------------------------------------------------------------
create function private.sync_paid_booking_from_voucher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.paid_bookings;
  v_offer public.offers;
  v_settings public.settings;
  v_refund boolean;
  v_reason public.booking_cancel_reason;
begin
  select * into v_booking from public.paid_bookings b where b.voucher_id = new.id for update;
  if not found then
    return null;
  end if;

  if new.status = 'no_show'
    and coalesce(current_setting('unfair.paid_no_show', true), '') <> new.id::text then
    perform private.raise_error(
      'NO_SHOW_BEZAHLT',
      'Bezahlte Buchungen bitte über mark_paid_no_show als nicht erschienen markieren.'
    );
  end if;

  if new.status = 'eingeloest' then
    select * into v_offer from public.offers o where o.id = new.offer_id;
    update public.paid_bookings b
    set status = case when b.status = 'bezahlt' then 'eingeloest'::public.booking_status else b.status end,
        payout_due_at = case
          when v_offer.type = 'zeitraum'
            then least(b.payout_due_at,
                       new.redeemed_at + make_interval(hours => (private.get_payment_settings()).payout_delay_hours))
          else b.payout_due_at
        end
    where b.id = v_booking.id;

  elsif new.status = 'no_show' then
    update public.paid_bookings b set status = 'no_show'
    where b.id = v_booking.id and b.status = 'bezahlt';

  elsif new.status = 'storniert' then
    v_reason := new.cancel_reason::text::public.booking_cancel_reason;
    v_refund := true;
    if new.cancel_reason = 'konto_geloescht' then
      -- Kontolöschung: Erstattung nur, solange auch ein Storno möglich gewesen wäre
      select * into v_offer from public.offers o where o.id = new.offer_id;
      v_settings := private.get_settings();
      v_refund := case
        when v_offer.type = 'einzeltermin'
          then now() <= v_offer.starts_at - make_interval(hours => v_settings.cancel_deadline_hours)
        else now() < v_offer.ends_at
      end;
    end if;

    update public.paid_bookings b
    set status = 'storniert', cancelled_at = now(), cancel_reason = v_reason
    where b.id = v_booking.id
    returning * into v_booking;

    if v_refund then
      perform private.enqueue_refund(v_booking, v_reason);
      -- Schon ausgezahlt (z. B. Absage nach dem Termin): Transfer zurückholen
      update public.payment_transfers t set status = 'zurueckholen'
      where t.booking_id = v_booking.id and t.status = 'ueberwiesen';
      if found then
        perform private.enqueue_payment_job('auszahlung_zurueckholen', v_booking.id);
      end if;
    end if;
  end if;

  return null;
end;
$$;

create trigger vouchers_sync_paid_booking
  after update of status on public.vouchers
  for each row
  when (old.status is distinct from new.status)
  execute function private.sync_paid_booking_from_voucher();

-- ----------------------------------------------------------------------------
-- Trigger 3 (offers, BEFORE INSERT): Bei Flag an veröffentlicht nur, wer ein
-- bereites Stripe-Konto hat („Auszahlungen einrichten“).
-- ----------------------------------------------------------------------------
create function private.guard_offer_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'aktiv'
    and private.payments_enabled()
    and not private.payout_account_ready(new.location_id) then
    perform private.raise_error(
      'AUSZAHLUNGEN_EINRICHTEN',
      'Bitte richte zuerst die Auszahlungen ein. Danach kannst du Angebote veröffentlichen.'
    );
  end if;
  return new;
end;
$$;

create trigger offers_guard_payments
  before insert on public.offers
  for each row execute function private.guard_offer_insert();

-- ============================================================================
-- RPCs für alle
-- ============================================================================

-- Flag, Provision usw. (App und Website). Gleiche Sicht wie die RLS-Policy.
create function public.get_payment_settings()
returns table (
  payments_enabled boolean,
  commission_bps integer,
  reservation_minutes integer,
  payout_delay_hours integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.payments_enabled, s.commission_bps, s.reservation_minutes, s.payout_delay_hours
  from public.payment_settings s where s.id;
$$;

-- ============================================================================
-- RPCs für Nutzer (aufgerufen über die Edge Functions mit dem Nutzer-JWT)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- start_paid_booking: Plätze 10 Minuten reservieren, Betrag und Provision
-- aus der DB. Gleiche Prüfungen wie claim_voucher (außer der No-Show-Sperre,
-- die es bei bezahlten Buchungen nicht gibt), dazu Flag, Stripe-Konto des
-- Standorts und Mindestbetrag. Sperrt das Angebot (FOR UPDATE), überbucht nie.
-- Eine ältere offene Reservierung desselben Nutzers für dasselbe Angebot wird
-- dabei freigegeben (Checkout neu gestartet).
-- ----------------------------------------------------------------------------
create function public.start_paid_booking(p_offer_id uuid, p_seats integer default 1)
returns table (
  id uuid,
  offer_id uuid,
  seats integer,
  amount_cents integer,
  commission_cents integer,
  currency text,
  status public.booking_status,
  reserved_until timestamptz,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
  v_offer public.offers;
  v_location_status public.location_status;
  v_settings public.payment_settings := private.get_payment_settings();
  v_old public.paid_bookings;
  v_booking public.paid_bookings;
  v_amount integer;
begin
  if not v_settings.payments_enabled then
    perform private.raise_error('ZAHLUNGEN_AUS', 'Buchen mit Bezahlung ist gerade nicht möglich.');
  end if;

  select * into v_profile from public.profiles p where p.id = v_uid;
  if not found or v_profile.role <> 'nutzer' then
    perform private.raise_error('NUR_NUTZER', 'Buchen können nur Nutzerkonten.');
  end if;
  if v_profile.first_name is null or v_profile.last_name is null then
    perform private.raise_error('PROFIL_UNVOLLSTAENDIG', 'Bitte gib zuerst Vor- und Nachnamen an.');
  end if;
  if p_seats is null or p_seats < 1 then
    perform private.raise_error('UNGUELTIGE_PLATZANZAHL', 'Bitte mindestens einen Platz wählen.');
  end if;

  select * into v_offer from public.offers o where o.id = p_offer_id for update;
  if not found then
    perform private.raise_error('ANGEBOT_NICHT_GEFUNDEN', 'Dieses Angebot gibt es nicht.');
  end if;

  select l.status into v_location_status from public.locations l where l.id = v_offer.location_id;
  if v_offer.status <> 'aktiv' or v_location_status <> 'approved' then
    perform private.raise_error('ANGEBOT_NICHT_AKTIV', 'Dieses Angebot ist nicht mehr verfügbar.');
  end if;
  if v_offer.type = 'einzeltermin' and now() >= v_offer.starts_at then
    perform private.raise_error('ANGEBOT_BEGONNEN', 'Der Termin hat schon begonnen.');
  end if;
  if v_offer.type = 'zeitraum' and now() >= v_offer.ends_at then
    perform private.raise_error('ANGEBOT_ABGELAUFEN', 'Der Zeitraum ist abgelaufen.');
  end if;
  if not private.payout_account_ready(v_offer.location_id) then
    perform private.raise_error(
      'ANBIETER_NICHT_BEREIT',
      'Dieser Anbieter kann gerade keine Buchungen mit Bezahlung annehmen.'
    );
  end if;
  if p_seats > v_offer.max_per_user then
    perform private.raise_error(
      'ZU_VIELE_PLAETZE',
      format('Pro Person sind höchstens %s Plätze möglich.', v_offer.max_per_user)
    );
  end if;
  if exists (
    select 1 from public.vouchers v
    where v.offer_id = p_offer_id and v.user_id = v_uid and v.status = 'aktiv'
  ) then
    perform private.raise_error('BEREITS_AKTIVER_CODE', 'Du hast für dieses Angebot schon einen Code.');
  end if;

  v_amount := v_offer.deal_price_cents * p_seats;
  if v_amount < 50 then
    perform private.raise_error('BETRAG_ZU_GERING', 'Buchungen mit Bezahlung gehen ab 0,50 €.');
  end if;

  -- Checkout neu gestartet: alte offene Reservierung freigeben (Plätze zurück)
  select * into v_old from public.paid_bookings b
  where b.offer_id = p_offer_id and b.user_id = v_uid and b.status = 'reserviert'
  for update;
  if found then
    perform private.release_reservation(v_old);
    select * into v_offer from public.offers o where o.id = p_offer_id;
  end if;

  if v_offer.capacity - v_offer.seats_taken < p_seats then
    perform private.raise_error(
      'AUSGEBUCHT',
      case when v_offer.capacity - v_offer.seats_taken = 0
        then 'Leider sind alle Plätze vergeben.'
        else format('Es sind nur noch %s Plätze frei.', v_offer.capacity - v_offer.seats_taken)
      end
    );
  end if;

  update public.offers o set seats_taken = o.seats_taken + p_seats where o.id = p_offer_id;

  insert into public.paid_bookings (
    offer_id, location_id, user_id, seats, unit_price_cents, amount_cents,
    commission_bps, commission_cents, reserved_until
  )
  values (
    p_offer_id, v_offer.location_id, v_uid, p_seats, v_offer.deal_price_cents, v_amount,
    v_settings.commission_bps, private.commission_cents(v_amount, v_settings.commission_bps),
    now() + make_interval(mins => v_settings.reservation_minutes)
  )
  returning * into v_booking;

  return query select v_booking.id, v_booking.offer_id, v_booking.seats, v_booking.amount_cents,
    v_booking.commission_cents, v_booking.currency, v_booking.status, v_booking.reserved_until, now();
end;
$$;

comment on function public.start_paid_booking is
  'Bezahlte Buchung starten: reserviert Plätze (FOR UPDATE auf dem Angebot), Betrag und Provision aus der DB. Nur bei payments_enabled.';

-- ----------------------------------------------------------------------------
-- cancel_paid_booking: eigene Buchung abbrechen bzw. stornieren
--   reserviert → sofort freigeben (PaymentIntent wird abgebrochen)
--   bezahlt    → Storno nach den Regeln von cancel_voucher, Erstattung folgt
-- ----------------------------------------------------------------------------
create function public.cancel_paid_booking(p_booking_id uuid)
returns table (
  id uuid,
  status public.booking_status,
  refund_amount_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
  v_booking public.paid_bookings;
begin
  select * into v_booking from public.paid_bookings b where b.id = p_booking_id and b.user_id = v_uid;
  if not found then
    perform private.raise_error('BUCHUNG_NICHT_GEFUNDEN', 'Diese Buchung gibt es nicht.');
  end if;

  if v_booking.status = 'reserviert' then
    perform 1 from public.offers o where o.id = v_booking.offer_id for update;
    select * into v_booking from public.paid_bookings b where b.id = p_booking_id for update;
    perform private.release_reservation(v_booking);
  elsif v_booking.status = 'bezahlt' and v_booking.voucher_id is not null then
    -- Gleiche Fristen und Prüfungen wie in Variante A; der Sync-Trigger merkt die Erstattung vor.
    perform public.cancel_voucher(v_booking.voucher_id);
  else
    perform private.raise_error('BUCHUNG_NICHT_AKTIV', 'Diese Buchung lässt sich nicht mehr stornieren.');
  end if;

  select * into v_booking from public.paid_bookings b where b.id = p_booking_id;
  return query select v_booking.id, v_booking.status,
    (select r.amount_cents from public.payment_refunds r where r.booking_id = v_booking.id);
end;
$$;

comment on function public.cancel_paid_booking is
  'Eigene Buchung abbrechen (reserviert) oder stornieren (bezahlt, gleiche Fristen wie cancel_voucher). Die Erstattung führt der Stripe-Worker aus.';

-- ============================================================================
-- RPCs für Standorte (Website)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- mark_paid_no_show: wie mark_no_show, aber für bezahlte Codes und ohne
-- Zähler und Sperre (nur Statistik). Das Unternehmen wird trotzdem bezahlt.
-- ----------------------------------------------------------------------------
create function public.mark_paid_no_show(p_voucher_id uuid)
returns table (
  id uuid,
  status public.voucher_status,
  no_show_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_location public.locations := private.require_location(true);
  v_voucher public.vouchers;
  v_offer public.offers;
begin
  select * into v_voucher from public.vouchers v where v.id = p_voucher_id;
  if found then
    select * into v_offer from public.offers o where o.id = v_voucher.offer_id;
  end if;
  if v_voucher.id is null or v_offer.location_id <> v_location.id
    or not exists (select 1 from public.paid_bookings b where b.voucher_id = p_voucher_id) then
    perform private.raise_error('CODE_NICHT_GEFUNDEN', 'Diesen Code gibt es nicht.');
  end if;
  if v_offer.type <> 'einzeltermin' then
    perform private.raise_error('NO_SHOW_NUR_EINZELTERMIN', 'No-Shows gibt es nur bei Einzelterminen.');
  end if;

  select * into v_voucher from public.vouchers v where v.id = p_voucher_id for update;
  if v_voucher.status <> 'aktiv' then
    perform private.raise_error('CODE_NICHT_AKTIV', 'Dieser Code ist nicht mehr aktiv.');
  end if;
  if now() < v_offer.starts_at then
    perform private.raise_error('NO_SHOW_ZU_FRUEH', 'No-Show erst ab Beginn des Termins.');
  end if;
  if now() > v_offer.ends_at + interval '48 hours' then
    perform private.raise_error('NO_SHOW_ZU_SPAET', 'No-Show nur bis 48 Std. nach Ende möglich.');
  end if;

  perform set_config('unfair.paid_no_show', p_voucher_id::text, true);
  update public.vouchers v
  set status = 'no_show', no_show_at = now(), no_show_by = v_location.account_user_id
  where v.id = p_voucher_id
  returning * into v_voucher;
  perform set_config('unfair.paid_no_show', '', true);

  perform private.log_event('no_show', v_offer, v_voucher.user_id, v_voucher.id, v_voucher.seats);

  return query select v_voucher.id, v_voucher.status, v_voucher.no_show_at;
end;
$$;

comment on function public.mark_paid_no_show is
  'Bezahlten Code als nicht erschienen markieren (Einzeltermin, ab Start bis 48 Std. nach Ende). Ohne No-Show-Zähler und ohne Sperre.';

-- ----------------------------------------------------------------------------
-- get_offer_participants_paid: Teilnehmerliste wie get_offer_participants,
-- dazu der Bezahlstatus (für die Teilnehmerliste der Website).
-- ----------------------------------------------------------------------------
create function public.get_offer_participants_paid(p_offer_id uuid)
returns table (
  voucher_id uuid,
  short_code text,
  seats integer,
  status public.voucher_status,
  claimed_at timestamptz,
  redeemed_at timestamptz,
  no_show_at timestamptz,
  first_name text,
  last_initial text,
  is_paid boolean,
  booking_id uuid,
  booking_status public.booking_status,
  amount_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  -- get_offer_participants prüft die Berechtigung und liefert die Reihenfolge
  select p.voucher_id, p.short_code, p.seats, p.status, p.claimed_at, p.redeemed_at, p.no_show_at,
    p.first_name, p.last_initial, b.id is not null, b.id, b.status, b.amount_cents
  from public.get_offer_participants(p_offer_id) p
  left join public.paid_bookings b on b.voucher_id = p.voucher_id;
$$;

comment on function public.get_offer_participants_paid is
  'Teilnehmerliste wie get_offer_participants plus Bezahlstatus (is_paid, booking_status, amount_cents).';

-- ----------------------------------------------------------------------------
-- get_location_bookings: bezahlte Buchungen mit Brutto, Provision, Netto und
-- Auszahlungsstatus. Standort: eigene. Admin: p_location_id oder alle.
-- Reservierungen ohne Zahlung (reserviert, abgelaufen) sind nicht enthalten.
-- ----------------------------------------------------------------------------
create function public.get_location_bookings(
  p_location_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  booking_id uuid,
  location_id uuid,
  location_name text,
  offer_id uuid,
  offer_title text,
  offer_type public.offer_type,
  starts_at timestamptz,
  ends_at timestamptz,
  first_name text,
  last_initial text,
  short_code text,
  seats integer,
  amount_cents integer,
  commission_cents integer,
  payout_cents integer,
  status public.booking_status,
  cancel_reason public.booking_cancel_reason,
  paid_at timestamptz,
  payout_due_at timestamptz,
  refund_status public.refund_status,
  refunded_at timestamptz,
  transfer_status public.transfer_status,
  transferred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := private.require_user();
  v_location_id uuid;
begin
  if private.is_admin() then
    v_location_id := p_location_id;
  else
    v_location_id := (private.require_location(false)).id;
  end if;
  if p_limit is null or p_limit not between 1 and 500 or p_offset is null or p_offset < 0 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Limit 1–500, Offset ab 0.');
  end if;

  return query
  select b.id, b.location_id, l.name, b.offer_id, o.title, o.type, o.starts_at, o.ends_at,
    coalesce(p.first_name, 'Gelöschtes Konto'), left(p.last_name, 1), v.short_code,
    b.seats, b.amount_cents, b.commission_cents, b.payout_cents, b.status, b.cancel_reason,
    b.paid_at, b.payout_due_at, r.status, r.refunded_at, t.status, t.transferred_at
  from public.paid_bookings b
  join public.offers o on o.id = b.offer_id
  join public.locations l on l.id = b.location_id
  left join public.profiles p on p.id = b.user_id
  left join public.vouchers v on v.id = b.voucher_id
  left join public.payment_refunds r on r.booking_id = b.id
  left join public.payment_transfers t on t.booking_id = b.id
  where b.status not in ('reserviert', 'abgelaufen')
    and (v_location_id is null or b.location_id = v_location_id)
  order by b.paid_at desc nulls last, b.id
  limit p_limit offset p_offset;
end;
$$;

comment on function public.get_location_bookings is
  'Bezahlte Buchungen mit Brutto, Provision, Netto, Erstattungs- und Auszahlungsstatus. Standort: eigene; Admin: ein Standort oder alle.';

-- ============================================================================
-- RPCs für Admins (Website)
-- ============================================================================

create function public.update_payment_settings(p_payments_enabled boolean, p_commission_bps integer)
returns table (
  payments_enabled boolean,
  commission_bps integer,
  reservation_minutes integer,
  payout_delay_hours integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin uuid := private.require_admin();
  v_row public.payment_settings;
begin
  if p_payments_enabled is null or p_commission_bps is null or p_commission_bps not between 0 and 5000 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Provision zwischen 0 und 50 %.');
  end if;

  update public.payment_settings s
  set payments_enabled = p_payments_enabled, commission_bps = p_commission_bps, updated_by = v_admin
  where s.id
  returning * into v_row;

  return query select v_row.payments_enabled, v_row.commission_bps, v_row.reservation_minutes,
    v_row.payout_delay_hours;
end;
$$;

comment on function public.update_payment_settings is
  'Admin: Flag payments_enabled und Provision (Basispunkte, 1500 = 15 %) setzen. Gilt nur für neue Buchungen.';

-- ----------------------------------------------------------------------------
-- get_admin_payment_metrics: Umsatz, Erstattungen, Provision und Auszahlungen
-- pro Woche (Mo., Berliner Zeit), dazu aktuelle Bestandszahlen.
--   gross       Summe bezahlter Buchungen (nach paid_at)
--   refunded    Summe erstatteter Beträge (nach refunded_at)
--   paid_out    Summe der Transfers an Standorte (nach transferred_at)
--   commission  Provision der ausgezahlten Buchungen (nach transferred_at)
-- ----------------------------------------------------------------------------
create function public.get_admin_payment_metrics(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := coalesce(p_from, (now() at time zone 'Europe/Berlin')::date - 83);
  v_to date := coalesce(p_to, (now() at time zone 'Europe/Berlin')::date);
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  perform private.require_admin();
  if v_from > v_to or v_to - v_from > 731 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Zeitraum: Beginn vor Ende, höchstens 2 Jahre.');
  end if;
  v_start := v_from::timestamp at time zone 'Europe/Berlin';
  v_end := (v_to + 1)::timestamp at time zone 'Europe/Berlin';

  with movements as (
    select b.paid_at as at, b.amount_cents as gross, 0 as refunded, 0 as paid_out, 0 as commission, 1 as bookings
    from public.paid_bookings b
    where b.paid_at >= v_start and b.paid_at < v_end
    union all
    select r.refunded_at, 0, r.amount_cents, 0, 0, 0
    from public.payment_refunds r
    where r.status = 'erstattet' and r.refunded_at >= v_start and r.refunded_at < v_end
    union all
    select t.transferred_at, 0, 0, t.amount_cents, b.amount_cents - t.amount_cents, 0
    from public.payment_transfers t
    join public.paid_bookings b on b.id = t.booking_id
    where t.transferred_at >= v_start and t.transferred_at < v_end
  ),
  weekly as (
    select date_trunc('week', m.at at time zone 'Europe/Berlin')::date as week_start,
      sum(m.bookings)::integer as bookings,
      sum(m.gross)::bigint as gross_cents,
      sum(m.refunded)::bigint as refunded_cents,
      sum(m.paid_out)::bigint as paid_out_cents,
      sum(m.commission)::bigint as commission_cents
    from movements m
    group by 1
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'totals', jsonb_build_object(
      'bookings', coalesce((select sum(w.bookings) from weekly w), 0),
      'gross_cents', coalesce((select sum(w.gross_cents) from weekly w), 0),
      'refunded_cents', coalesce((select sum(w.refunded_cents) from weekly w), 0),
      'paid_out_cents', coalesce((select sum(w.paid_out_cents) from weekly w), 0),
      'commission_cents', coalesce((select sum(w.commission_cents) from weekly w), 0)
    ),
    'by_week', coalesce((select jsonb_agg(to_jsonb(w) order by w.week_start) from weekly w), '[]'::jsonb),
    'current', jsonb_build_object(
      'payments_enabled', private.payments_enabled(),
      'open_reservations', (select count(*) from public.paid_bookings where status = 'reserviert'),
      'payouts_due', (
        select count(*) from public.paid_bookings b
        where b.status in ('bezahlt', 'eingeloest', 'no_show', 'storniert')
          and b.payout_due_at <= now()
          and not exists (select 1 from public.payment_refunds r where r.booking_id = b.id)
          and not exists (select 1 from public.payment_transfers t where t.booking_id = b.id)
      ),
      'refunds_open', (select count(*) from public.payment_refunds where status in ('offen', 'angefragt')),
      'jobs_failed', (select count(*) from public.payment_jobs where status = 'fehlgeschlagen'),
      'disputes_open', (select count(*) from public.payment_disputes where closed_at is null),
      'locations_ready', (select count(*) from public.stripe_accounts where is_ready),
      -- Warnung vor dem Einschalten: aktive Angebote ohne bereites Stripe-Konto
      'offers_without_payout_account', (
        select count(*) from public.offers o
        where o.status = 'aktiv'
          and case when o.type = 'einzeltermin' then o.starts_at > now() else o.ends_at > now() end
          and not private.payout_account_ready(o.location_id)
      ),
      'as_of', now()
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_payment_metrics is
  'Admin: Umsatz (gross), Erstattungen, Auszahlungen und Provision pro Woche (Mo., Berliner Zeit) sowie aktuelle Bestandszahlen der Zahlungen.';

-- ============================================================================
-- Funktionen nur für service_role (Edge Functions)
-- ============================================================================

-- PaymentIntent an eine offene Reservierung hängen. Idempotent.
create function public.attach_payment_intent(p_booking_id uuid, p_payment_intent_id text)
returns public.paid_bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.paid_bookings;
begin
  select * into v_booking from public.paid_bookings b where b.id = p_booking_id for update;
  if not found then
    perform private.raise_error('BUCHUNG_NICHT_GEFUNDEN', 'Diese Buchung gibt es nicht.');
  end if;
  if v_booking.payment_intent_id is not null and v_booking.payment_intent_id <> p_payment_intent_id then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Die Buchung hat schon einen anderen PaymentIntent.');
  end if;
  if v_booking.status <> 'reserviert' then
    perform private.raise_error('RESERVIERUNG_ABGELAUFEN', 'Die Reservierung ist abgelaufen. Bitte starte die Buchung neu.');
  end if;

  update public.paid_bookings b set payment_intent_id = p_payment_intent_id
  where b.id = p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- ----------------------------------------------------------------------------
-- confirm_paid_booking: vom Webhook payment_intent.succeeded. Idempotent.
-- Ergebnis (outcome):
--   bestaetigt              Reservierung bezahlt, Code ausgegeben
--   bestaetigt_nachtraeglich Reservierung war abgelaufen, Platz noch frei
--   erstattung              Reservierung abgelaufen und Platz weg → Vollerstattung vorgemerkt
--   bereits_verarbeitet     Zahlung war schon verbucht
-- ----------------------------------------------------------------------------
create function public.confirm_paid_booking(
  p_booking_id uuid,
  p_payment_intent_id text,
  p_charge_id text,
  p_amount_received integer,
  p_currency text
)
returns table (
  booking_id uuid,
  outcome text,
  status public.booking_status,
  voucher_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_booking public.paid_bookings;
  v_offer public.offers;
  v_location_status public.location_status;
  v_voucher_id uuid;
  v_outcome text;
  v_seat_free boolean;
begin
  select * into v_booking from public.paid_bookings b
  where b.id = p_booking_id and (b.payment_intent_id = p_payment_intent_id or b.payment_intent_id is null);
  if not found then
    perform private.raise_error('BUCHUNG_NICHT_GEFUNDEN', 'Zu diesem PaymentIntent gibt es keine Buchung.');
  end if;

  -- Sperrreihenfolge: Angebot, dann Buchung
  select * into v_offer from public.offers o where o.id = v_booking.offer_id for update;
  select * into v_booking from public.paid_bookings b where b.id = p_booking_id for update;

  if v_booking.charge_id is not null then
    return query select v_booking.id, 'bereits_verarbeitet'::text, v_booking.status, v_booking.voucher_id;
    return;
  end if;
  if p_amount_received is distinct from v_booking.amount_cents or lower(p_currency) <> v_booking.currency then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Betrag oder Währung passen nicht zur Buchung.');
  end if;

  update public.paid_bookings b
  set payment_intent_id = p_payment_intent_id, charge_id = p_charge_id, paid_at = now()
  where b.id = v_booking.id
  returning * into v_booking;

  select l.status into v_location_status from public.locations l where l.id = v_offer.location_id;

  if v_booking.status = 'reserviert' then
    -- Plätze sind noch gehalten und gehen jetzt auf den Code über.
    -- Angebot inzwischen abgesagt/entfernt oder Nutzer hat schon einen Code: Plätze frei, erstatten.
    if v_offer.status = 'aktiv' and v_location_status = 'approved' then
      v_voucher_id := private.issue_paid_voucher(v_booking);
    end if;
    if v_voucher_id is not null then
      v_outcome := 'bestaetigt';
    else
      update public.offers o set seats_taken = o.seats_taken - v_booking.seats where o.id = v_offer.id;
      v_outcome := 'erstattung';
    end if;

  elsif v_booking.status = 'abgelaufen' then
    v_seat_free := v_offer.status = 'aktiv'
      and v_location_status = 'approved'
      and case when v_offer.type = 'einzeltermin' then now() < v_offer.starts_at else now() < v_offer.ends_at end
      and v_offer.capacity - v_offer.seats_taken >= v_booking.seats;
    if v_seat_free then
      v_voucher_id := private.issue_paid_voucher(v_booking);
    end if;
    if v_voucher_id is not null then
      update public.offers o set seats_taken = o.seats_taken + v_booking.seats where o.id = v_offer.id;
      v_outcome := 'bestaetigt_nachtraeglich';
    else
      v_outcome := 'erstattung';
    end if;

  else
    -- z. B. von Hand storniert, bevor die Zahlung kam: Geld zurück
    v_outcome := 'erstattung';
  end if;

  if v_outcome = 'erstattung' then
    update public.paid_bookings b
    set status = 'storniert', cancelled_at = now(), cancel_reason = 'zahlung_zu_spaet'
    where b.id = v_booking.id
    returning * into v_booking;
    perform private.enqueue_refund(v_booking, 'zahlung_zu_spaet');
  else
    update public.paid_bookings b
    set status = 'bezahlt', voucher_id = v_voucher_id, payout_due_at = private.payout_due_at(v_offer)
    where b.id = v_booking.id
    returning * into v_booking;
    perform private.log_event('code_geholt', v_offer, v_booking.user_id, v_voucher_id, v_booking.seats);
  end if;

  return query select v_booking.id, v_outcome, v_booking.status, v_booking.voucher_id;
end;
$$;

comment on function public.confirm_paid_booking is
  'service_role (Webhook payment_intent.succeeded): Zahlung verbuchen, Code ausgeben bzw. bei verspäteter Zahlung ohne freien Platz die Vollerstattung vormerken. Idempotent.';

-- ----------------------------------------------------------------------------
-- Webhook-Events: einmal verarbeiten
-- record_webhook_event → true, wenn das Event noch verarbeitet werden muss.
-- ----------------------------------------------------------------------------
create function public.record_webhook_event(
  p_event_id text,
  p_type text,
  p_livemode boolean,
  p_created timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_processed timestamptz;
begin
  insert into public.stripe_webhook_events (event_id, type, livemode, stripe_created_at)
  values (p_event_id, p_type, p_livemode, p_created)
  on conflict (event_id) do update set attempts = public.stripe_webhook_events.attempts + 1
  returning processed_at into v_processed;
  return v_processed is null;
end;
$$;

create function public.finish_webhook_event(p_event_id text, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stripe_webhook_events e
  set processed_at = case when p_error is null then now() end, last_error = p_error
  where e.event_id = p_event_id;
$$;

-- ----------------------------------------------------------------------------
-- Stripe-Konto eines Standorts anlegen bzw. abgleichen
-- ----------------------------------------------------------------------------
create function public.register_stripe_account(p_location_id uuid, p_stripe_account_id text)
returns public.stripe_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stripe_accounts;
begin
  insert into public.stripe_accounts (location_id, stripe_account_id)
  values (p_location_id, p_stripe_account_id)
  on conflict (location_id) do nothing;
  select * into v_row from public.stripe_accounts a where a.location_id = p_location_id;
  return v_row;
end;
$$;

create function public.sync_stripe_account(
  p_stripe_account_id text,
  p_details_submitted boolean,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_transfers_active boolean,
  p_requirements_due text[],
  p_disabled_reason text
)
returns public.stripe_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stripe_accounts;
begin
  update public.stripe_accounts a
  set details_submitted = coalesce(p_details_submitted, false),
      charges_enabled = coalesce(p_charges_enabled, false),
      payouts_enabled = coalesce(p_payouts_enabled, false),
      transfers_active = coalesce(p_transfers_active, false),
      requirements_due = coalesce(p_requirements_due, '{}'),
      disabled_reason = p_disabled_reason,
      synced_at = now()
  where a.stripe_account_id = p_stripe_account_id
  returning * into v_row;
  return v_row;  -- null, wenn das Konto nicht zu uns gehört
end;
$$;

-- ----------------------------------------------------------------------------
-- Rückbuchung erfassen bzw. aktualisieren (charge.dispute.*)
-- ----------------------------------------------------------------------------
create function public.record_dispute(
  p_stripe_dispute_id text,
  p_charge_id text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_reason text,
  p_stripe_status text,
  p_evidence_due_by timestamptz,
  p_closed boolean
)
returns public.payment_disputes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_row public.payment_disputes;
begin
  select b.id into v_booking_id from public.paid_bookings b
  where b.charge_id = p_charge_id or (p_payment_intent_id is not null and b.payment_intent_id = p_payment_intent_id)
  limit 1;

  insert into public.payment_disputes (
    stripe_dispute_id, booking_id, charge_id, amount_cents, reason, stripe_status, evidence_due_by, closed_at
  )
  values (
    p_stripe_dispute_id, v_booking_id, p_charge_id, p_amount_cents, p_reason, p_stripe_status,
    p_evidence_due_by, case when p_closed then now() end
  )
  on conflict (stripe_dispute_id) do update
  set stripe_status = excluded.stripe_status,
      amount_cents = excluded.amount_cents,
      reason = excluded.reason,
      evidence_due_by = excluded.evidence_due_by,
      booking_id = coalesce(public.payment_disputes.booking_id, excluded.booking_id),
      closed_at = case when p_closed then coalesce(public.payment_disputes.closed_at, now()) end
  returning * into v_row;
  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- Stand einer Erstattung aus dem Webhook (refund.updated, charge.refunded)
-- ----------------------------------------------------------------------------
create function public.update_refund_status(p_stripe_refund_id text, p_stripe_status text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.payment_refunds;
begin
  select * into v_refund from public.payment_refunds r where r.stripe_refund_id = p_stripe_refund_id for update;
  if not found then
    return;
  end if;

  if p_stripe_status = 'succeeded' then
    update public.payment_refunds r set status = 'erstattet', refunded_at = coalesce(r.refunded_at, now()), last_error = null
    where r.id = v_refund.id;
    update public.paid_bookings b set status = 'erstattet', refunded_at = coalesce(b.refunded_at, now())
    where b.id = v_refund.booking_id and b.status = 'storniert';
  elsif p_stripe_status in ('failed', 'canceled') then
    update public.payment_refunds r set status = 'fehlgeschlagen', last_error = coalesce(p_error, p_stripe_status)
    where r.id = v_refund.id;
  else
    update public.payment_refunds r set status = 'angefragt' where r.id = v_refund.id and r.status = 'offen';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Stripe-Worker: fällige Auszahlungen vormerken, Jobs abholen, Ergebnis melden
-- ----------------------------------------------------------------------------

-- Auszahlung fällig: nicht stornierte bzw. ohne Erstattung stornierte Buchungen
-- nach payout_due_at, Stripe-Konto bereit, noch kein Transfer.
create function private.enqueue_due_payouts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.payment_jobs (kind, booking_id)
  select 'auszahlen', b.id
  from public.paid_bookings b
  join public.stripe_accounts a on a.location_id = b.location_id and a.is_ready
  where b.status in ('bezahlt', 'eingeloest', 'no_show', 'storniert')
    and b.payout_due_at <= now()
    and b.charge_id is not null
    and not exists (select 1 from public.payment_refunds r where r.booking_id = b.id)
    and not exists (select 1 from public.payment_transfers t where t.booking_id = b.id)
  on conflict (kind, booking_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Abgelaufene Reservierungen und Reservierungen nicht mehr aktiver Angebote freigeben
create function private.release_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_booking public.paid_bookings;
  v_count integer := 0;
begin
  for v_item in
    select b.id, b.offer_id
    from public.paid_bookings b
    join public.offers o on o.id = b.offer_id
    where b.status = 'reserviert' and (b.reserved_until <= now() or o.status <> 'aktiv')
    order by b.offer_id, b.id
  loop
    perform 1 from public.offers o where o.id = v_item.offer_id for update;
    select * into v_booking from public.paid_bookings b where b.id = v_item.id for update;
    if v_booking.status = 'reserviert' then
      perform private.release_reservation(v_booking);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Cron (jede Minute): Reservierungen freigeben, fällige Auszahlungen vormerken
create function private.run_payment_maintenance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.release_expired_reservations();
  perform private.enqueue_due_payouts();
end;
$$;

-- ----------------------------------------------------------------------------
-- claim_payment_jobs: fällige Jobs für den Worker holen (FOR UPDATE SKIP LOCKED),
-- auf laeuft setzen und 10 Minuten reservieren. Mit p_booking_id nur die Jobs
-- dieser Buchung (sofortige Erstattung nach einem Storno).
-- Liefert alles, was der Worker für den Stripe-Aufruf braucht.
-- ----------------------------------------------------------------------------
create function public.claim_payment_jobs(p_limit integer default 20, p_booking_id uuid default null)
returns table (
  job_id bigint,
  kind public.payment_job_kind,
  attempts integer,
  booking_id uuid,
  payment_intent_id text,
  charge_id text,
  refund_amount_cents integer,
  payout_cents integer,
  destination_account_id text,
  stripe_transfer_id text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_limit is null or p_limit not between 1 and 100 then
    perform private.raise_error('UNGUELTIGE_EINGABE', 'Limit 1–100.');
  end if;

  -- Auszahlung entfällt, wenn die Buchung inzwischen erstattet wird
  update public.payment_jobs j
  set status = 'erledigt', last_error = 'ENTFALLEN', finished_at = now()
  where j.kind = 'auszahlen' and j.status = 'offen'
    and exists (select 1 from public.payment_refunds r where r.booking_id = j.booking_id);

  -- Fünfmal abgeholt ohne Rückmeldung: endgültig fehlgeschlagen
  update public.payment_jobs j
  set status = 'fehlgeschlagen', last_error = coalesce(j.last_error, 'ABGEBROCHEN'), finished_at = now()
  where j.status = 'laeuft' and j.next_attempt_at <= now() and j.attempts >= 5;

  return query
  with picked as (
    select j.id from public.payment_jobs j
    where j.status in ('offen', 'laeuft') and j.next_attempt_at <= now()
      and (p_booking_id is null or j.booking_id = p_booking_id)
    order by j.next_attempt_at, j.id
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.payment_jobs j
    set status = 'laeuft', attempts = j.attempts + 1, next_attempt_at = now() + interval '10 minutes'
    from picked
    where j.id = picked.id
    returning j.*
  )
  select c.id, c.kind, c.attempts, b.id, b.payment_intent_id, b.charge_id,
    r.amount_cents, b.payout_cents, a.stripe_account_id, t.stripe_transfer_id
  from claimed c
  join public.paid_bookings b on b.id = c.booking_id
  left join public.payment_refunds r on r.booking_id = b.id
  left join public.stripe_accounts a on a.location_id = b.location_id
  left join public.payment_transfers t on t.booking_id = b.id
  order by c.id;
end;
$$;

-- ----------------------------------------------------------------------------
-- finish_payment_job: Ergebnis eines Stripe-Aufrufs verbuchen.
--   p_ok = true:  p_stripe_id = Refund-, Transfer- bzw. Reversal-ID,
--                 p_stripe_status = Status des Refunds (succeeded/pending)
--   p_ok = false: Wiederholung mit Backoff (Versuche² Minuten), endgültig bei
--                 p_permanent oder ab 5 Versuchen
-- ----------------------------------------------------------------------------
create function public.finish_payment_job(
  p_job_id bigint,
  p_ok boolean,
  p_stripe_id text default null,
  p_stripe_status text default null,
  p_error text default null,
  p_permanent boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.payment_jobs;
  v_booking public.paid_bookings;
begin
  select * into v_job from public.payment_jobs j where j.id = p_job_id for update;
  if not found or v_job.status <> 'laeuft' then
    return;  -- schon erledigt (doppelter Aufruf)
  end if;

  if not p_ok then
    update public.payment_jobs j
    set status = case when p_permanent or j.attempts >= 5 then 'fehlgeschlagen'::public.payment_job_status
                      else 'offen'::public.payment_job_status end,
        next_attempt_at = now() + make_interval(mins => j.attempts * j.attempts),
        last_error = left(coalesce(p_error, 'FEHLER'), 1000),
        finished_at = case when p_permanent or j.attempts >= 5 then now() end
    where j.id = p_job_id;
    if v_job.kind = 'erstatten' and (p_permanent or v_job.attempts >= 5) then
      update public.payment_refunds r set status = 'fehlgeschlagen', last_error = left(p_error, 1000)
      where r.booking_id = v_job.booking_id;
    elsif v_job.kind = 'auszahlung_zurueckholen' and (p_permanent or v_job.attempts >= 5) then
      update public.payment_transfers t set status = 'fehlgeschlagen', last_error = left(p_error, 1000)
      where t.booking_id = v_job.booking_id;
    end if;
    return;
  end if;

  update public.payment_jobs j set status = 'erledigt', finished_at = now(), last_error = null
  where j.id = p_job_id;

  select * into v_booking from public.paid_bookings b where b.id = v_job.booking_id for update;

  if v_job.kind = 'erstatten' then
    update public.payment_refunds r set stripe_refund_id = p_stripe_id, status = 'angefragt'
    where r.booking_id = v_job.booking_id and r.status in ('offen', 'fehlgeschlagen');
    if p_stripe_id is not null then
      perform public.update_refund_status(p_stripe_id, p_stripe_status);
    end if;

  elsif v_job.kind = 'auszahlen' then
    insert into public.payment_transfers (
      booking_id, location_id, destination_account_id, source_charge_id, amount_cents, stripe_transfer_id
    )
    select v_booking.id, v_booking.location_id, a.stripe_account_id, v_booking.charge_id,
      v_booking.payout_cents, p_stripe_id
    from public.stripe_accounts a where a.location_id = v_booking.location_id
    on conflict (booking_id) do nothing;
    -- Während des Stripe-Aufrufs storniert und erstattet: Transfer gleich zurückholen
    if exists (select 1 from public.payment_refunds r where r.booking_id = v_booking.id) then
      update public.payment_transfers t set status = 'zurueckholen'
      where t.booking_id = v_booking.id and t.status = 'ueberwiesen';
      perform private.enqueue_payment_job('auszahlung_zurueckholen', v_booking.id);
    else
      update public.paid_bookings b set status = 'ausgezahlt', paid_out_at = now()
      where b.id = v_booking.id and b.status in ('bezahlt', 'eingeloest', 'no_show', 'storniert');
    end if;

  elsif v_job.kind = 'auszahlung_zurueckholen' then
    update public.payment_transfers t
    set status = 'zurueckgeholt', stripe_reversal_id = p_stripe_id, reversed_at = now()
    where t.booking_id = v_job.booking_id;
  end if;
  -- pi_abbrechen: nichts weiter zu verbuchen
end;
$$;

-- ----------------------------------------------------------------------------
-- Rechte
-- ----------------------------------------------------------------------------
revoke all on function private.payments_enabled() from public;
revoke all on function private.get_payment_settings() from public;
revoke all on function private.commission_cents(integer, integer) from public;
revoke all on function private.payout_account_ready(uuid) from public;
revoke all on function private.payout_due_at(public.offers) from public;
revoke all on function private.enqueue_payment_job(public.payment_job_kind, uuid) from public;
revoke all on function private.enqueue_refund(public.paid_bookings, public.booking_cancel_reason) from public;
revoke all on function private.release_reservation(public.paid_bookings) from public;
revoke all on function private.issue_paid_voucher(public.paid_bookings) from public;
revoke all on function private.guard_voucher_insert() from public;
revoke all on function private.sync_paid_booking_from_voucher() from public;
revoke all on function private.guard_offer_insert() from public;
revoke all on function private.enqueue_due_payouts() from public;
revoke all on function private.release_expired_reservations() from public;
revoke all on function private.run_payment_maintenance() from public;

revoke all on function public.get_payment_settings() from public;
revoke all on function public.start_paid_booking(uuid, integer) from public;
revoke all on function public.cancel_paid_booking(uuid) from public;
revoke all on function public.mark_paid_no_show(uuid) from public;
revoke all on function public.get_offer_participants_paid(uuid) from public;
revoke all on function public.get_location_bookings(uuid, integer, integer) from public;
revoke all on function public.update_payment_settings(boolean, integer) from public;
revoke all on function public.get_admin_payment_metrics(date, date) from public;
revoke all on function public.attach_payment_intent(uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_paid_booking(uuid, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.record_webhook_event(text, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.finish_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.register_stripe_account(uuid, text) from public, anon, authenticated;
revoke all on function public.sync_stripe_account(text, boolean, boolean, boolean, boolean, text[], text) from public, anon, authenticated;
revoke all on function public.record_dispute(text, text, text, integer, text, text, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.update_refund_status(text, text, text) from public, anon, authenticated;
revoke all on function public.claim_payment_jobs(integer, uuid) from public, anon, authenticated;
revoke all on function public.finish_payment_job(bigint, boolean, text, text, text, boolean) from public, anon, authenticated;

grant execute on function public.get_payment_settings() to anon, authenticated;
grant execute on function public.start_paid_booking(uuid, integer) to authenticated;
grant execute on function public.cancel_paid_booking(uuid) to authenticated;
grant execute on function public.mark_paid_no_show(uuid) to authenticated;
grant execute on function public.get_offer_participants_paid(uuid) to authenticated;
grant execute on function public.get_location_bookings(uuid, integer, integer) to authenticated;
grant execute on function public.update_payment_settings(boolean, integer) to authenticated;
grant execute on function public.get_admin_payment_metrics(date, date) to authenticated;

grant execute on function public.attach_payment_intent(uuid, text) to service_role;
grant execute on function public.confirm_paid_booking(uuid, text, text, integer, text) to service_role;
grant execute on function public.record_webhook_event(text, text, boolean, timestamptz) to service_role;
grant execute on function public.finish_webhook_event(text, text) to service_role;
grant execute on function public.register_stripe_account(uuid, text) to service_role;
grant execute on function public.sync_stripe_account(text, boolean, boolean, boolean, boolean, text[], text) to service_role;
grant execute on function public.record_dispute(text, text, text, integer, text, text, timestamptz, boolean) to service_role;
grant execute on function public.update_refund_status(text, text, text) to service_role;
grant execute on function public.claim_payment_jobs(integer, uuid) to service_role;
grant execute on function public.finish_payment_job(bigint, boolean, text, text, text, boolean) to service_role;

-- ----------------------------------------------------------------------------
-- Cron: jede Minute Reservierungen freigeben und fällige Auszahlungen vormerken.
-- (Den Stripe-Worker ruft ein eigener Job aus der Migration payments_worker auf.)
-- ----------------------------------------------------------------------------
select cron.schedule('unfair-pay-maintenance', '* * * * *', 'select private.run_payment_maintenance()');
