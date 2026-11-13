import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  BOOKING_STATUS_LABELS,
  PAYOUT_ACCOUNT_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
  formatDateTime,
  formatPrice,
  offerTimeLabel,
  payoutAccountStatus,
} from '@repo/shared';
import { Card, buttonClass } from '@/components/ui';
import { OnboardingButton, StripeDashboardButton } from '@/components/zahlungen/connect-actions';
import { getLocationPayoutData, type LocationBooking } from '@/lib/zahlungen/queries';
import { invokeConnect, paymentReturnUrls } from '@/lib/zahlungen/connect';

export const metadata: Metadata = { title: 'Auszahlungen' };

interface PageProps {
  searchParams: Promise<{ angebot?: string; zurueck?: string; neu?: string; status?: string }>;
}

function BookingRows({ bookings }: { bookings: LocationBooking[] }) {
  if (bookings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-headline text-text-primary">Noch keine bezahlten Buchungen</p>
        <p className="mt-1 text-callout text-text-secondary">
          Sobald Zahlungen über die App eingehen, findest du sie hier.
        </p>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface-raised shadow-card">
      <table className="min-w-[900px] w-full text-left text-footnote">
        <thead className="border-b border-border-subtle bg-background-muted text-text-secondary">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Angebot und Buchung
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Brutto
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Provision
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Netto
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {bookings.map((booking) => (
            <tr key={booking.booking_id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-semibold text-text-primary">{booking.offer_title}</p>
                <p className="mt-0.5 text-text-secondary">
                  {
                    offerTimeLabel({
                      type: booking.offer_type,
                      startsAt: booking.starts_at,
                      endsAt: booking.ends_at,
                    }).text
                  }
                </p>
                <p className="mt-1 text-text-tertiary">
                  {booking.first_name} {booking.last_initial ? `${booking.last_initial}.` : ''}
                  {' · '}
                  {booking.seats} {booking.seats === 1 ? 'Platz' : 'Plätze'}
                  {booking.short_code ? ` · Code ${booking.short_code}` : ''}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-text-primary">
                {formatPrice(booking.amount_cents)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                {formatPrice(booking.commission_cents)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-text-primary">
                {formatPrice(booking.payout_cents)}
              </td>
              <td className="min-w-48 px-4 py-3 text-text-secondary">
                <p>{BOOKING_STATUS_LABELS[booking.status]}</p>
                <p className="mt-1">
                  {booking.refund_status
                    ? REFUND_STATUS_LABELS[booking.refund_status]
                    : 'Keine Erstattung'}
                </p>
                <p className="mt-1">
                  {booking.transfer_status
                    ? TRANSFER_STATUS_LABELS[booking.transfer_status]
                    : booking.payout_due_at
                      ? `Auszahlung fällig ${formatDateTime(booking.payout_due_at)}`
                      : 'Noch keine Auszahlung'}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function PayoutContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getLocationPayoutData();

  if (params.zurueck === '1') {
    const result = await invokeConnect({ action: 'status' });
    redirect(`/auszahlungen?status=${result.error ? 'aktualisierungsfehler' : 'aktualisiert'}`);
  }

  let onboardingError: string | undefined;
  if (params.neu === '1') {
    const result = await invokeConnect({ action: 'onboarding', ...paymentReturnUrls() });
    if (result.result?.url) redirect(result.result.url);
    onboardingError = result.error ?? 'Der neue Stripe-Link konnte nicht erstellt werden.';
  }

  const selectedOffer = data.offers.some((offer) => offer.id === params.angebot)
    ? params.angebot
    : '';
  const bookings = selectedOffer
    ? data.bookings.filter((booking) => booking.offer_id === selectedOffer)
    : data.bookings;
  const accountStatus = payoutAccountStatus(data.account);

  return (
    <>
      {params.status === 'aktualisiert' ? (
        <p
          role="status"
          className="mb-5 rounded-card bg-status-success-subtle px-4 py-3 text-callout text-status-success-on-subtle"
        >
          Dein Stripe-Status wurde aktualisiert.
        </p>
      ) : params.status === 'aktualisierungsfehler' ? (
        <p
          role="alert"
          className="mb-5 rounded-card bg-status-warning-subtle px-4 py-3 text-callout text-status-warning-on-subtle"
        >
          Der Status konnte gerade nicht bei Stripe aktualisiert werden. Bitte versuche es erneut.
        </p>
      ) : null}

      {onboardingError ? (
        <p
          role="alert"
          className="mb-5 rounded-card bg-status-error-subtle px-4 py-3 text-callout text-status-error-on-subtle"
        >
          {onboardingError}
        </p>
      ) : null}

      <section aria-labelledby="konto-status" className="mb-10">
        <h2 id="konto-status" className="mb-3 text-headline text-text-primary">
          Stripe-Konto
        </h2>
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-subhead font-semibold text-text-primary">
              {PAYOUT_ACCOUNT_STATUS_LABELS[accountStatus]}
            </p>
            <p className="mt-1 max-w-2xl text-callout text-text-secondary">
              {accountStatus === 'aktiv'
                ? 'Dein Konto kann Auszahlungen empfangen. Öffne dein Stripe-Dashboard, um deine Bankdaten und Auszahlungen zu verwalten.'
                : 'Richte dein Stripe-Konto ein, damit Auszahlungen für deine bezahlten Buchungen möglich sind.'}
            </p>
            {data.account && data.account.requirements_due.length > 0 ? (
              <p className="mt-2 text-footnote text-status-warning-text">
                Stripe benötigt noch Angaben. Öffne die Einrichtung, um die offenen Punkte zu
                ergänzen.
              </p>
            ) : null}
          </div>
          {accountStatus === 'aktiv' ? <StripeDashboardButton /> : <OnboardingButton />}
        </Card>
      </section>

      <section aria-labelledby="buchungen">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="buchungen" className="text-headline text-text-primary">
              Bezahlte Buchungen
            </h2>
            <p className="mt-1 text-callout text-text-secondary">
              Brutto, Provision, dein Auszahlungsbetrag und Erstattungsstatus.
            </p>
          </div>
          {data.offers.length > 0 ? (
            <form method="get" className="flex items-end gap-2">
              <label htmlFor="angebot" className="text-footnote text-text-secondary">
                Angebot
                <select
                  id="angebot"
                  name="angebot"
                  defaultValue={selectedOffer}
                  className="mt-1 block min-h-11 max-w-xs rounded-input border border-border-default bg-surface-default px-3 text-body text-text-primary"
                >
                  <option value="">Alle Angebote</option>
                  {data.offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonClass('secondary', 'px-4')}>
                Filtern
              </button>
            </form>
          ) : null}
        </div>
        <BookingRows bookings={bookings} />
      </section>
      <p className="mt-5 text-footnote text-text-tertiary">
        Zeiten werden in Europe/Berlin angezeigt. Für Fragen zu einer Auszahlung findest du die
        Buchungsdetails in deinem Stripe-Dashboard.
      </p>
    </>
  );
}

export default function PayoutsPage(props: PageProps) {
  return (
    <>
      <h1 className="mb-2 text-title2 text-text-primary">Auszahlungen</h1>
      <p className="mb-6 max-w-2xl text-callout text-text-secondary">
        Verwalte dein Stripe-Konto und behalte bezahlte Buchungen und Auszahlungen im Blick.
      </p>
      <Suspense
        fallback={
          <p className="text-callout text-text-tertiary">Auszahlungsdaten werden geladen …</p>
        }
      >
        <PayoutContent {...props} />
      </Suspense>
    </>
  );
}
