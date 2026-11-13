import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { formatDateTime, formatPrice, offerTimeLabel, payoutAccountStatus } from '@repo/shared';
import { Card, buttonClass } from '@/components/ui';
import { OnboardingButton, StripeDashboardButton } from '@/components/zahlungen/connect-actions';
import { getT } from '@/lib/i18n/locale';
import { getLocationPayoutData, type LocationBooking } from '@/lib/zahlungen/queries';
import { invokeConnect, paymentReturnUrls } from '@/lib/zahlungen/connect';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.payments.title };
}

type I18n = Awaited<ReturnType<typeof getT>>;

interface PageProps {
  searchParams: Promise<{ angebot?: string; zurueck?: string; neu?: string; status?: string }>;
}

function BookingRows({ bookings, i18n }: { bookings: LocationBooking[]; i18n: I18n }) {
  const { locale, labels } = i18n;
  const p = i18n.t.payments;
  if (bookings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-headline text-text-primary">{p.emptyTitle}</p>
        <p className="mt-1 text-callout text-text-secondary">{p.emptyText}</p>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface-raised shadow-card">
      <table className="min-w-[900px] w-full text-left text-footnote">
        <thead className="border-b border-border-subtle bg-background-muted text-text-secondary">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              {p.colBooking}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {p.colGross}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {p.colCommission}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {p.colNet}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {p.colStatus}
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
                    offerTimeLabel(
                      {
                        type: booking.offer_type,
                        startsAt: booking.starts_at,
                        endsAt: booking.ends_at,
                      },
                      new Date(),
                      locale,
                    ).text
                  }
                </p>
                <p className="mt-1 text-text-tertiary">
                  {booking.first_name} {booking.last_initial ? `${booking.last_initial}.` : ''}
                  {' · '}
                  {p.seats(booking.seats)}
                  {booking.short_code ? ` · ${p.code(booking.short_code)}` : ''}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-text-primary">
                {formatPrice(booking.amount_cents, { locale })}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                {formatPrice(booking.commission_cents, { locale })}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-text-primary">
                {formatPrice(booking.payout_cents, { locale })}
              </td>
              <td className="min-w-48 px-4 py-3 text-text-secondary">
                <p>{labels.bookingStatus[booking.status]}</p>
                <p className="mt-1">
                  {booking.refund_status ? labels.refundStatus[booking.refund_status] : p.noRefund}
                </p>
                <p className="mt-1">
                  {booking.transfer_status
                    ? labels.transferStatus[booking.transfer_status]
                    : booking.payout_due_at
                      ? p.payoutDue(formatDateTime(booking.payout_due_at, new Date(), locale))
                      : p.noPayout}
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
  const [params, i18n] = await Promise.all([searchParams, getT()]);
  const p = i18n.t.payments;
  const data = await getLocationPayoutData();

  if (params.zurueck === '1') {
    const result = await invokeConnect({ action: 'status' });
    redirect(`/auszahlungen?status=${result.error ? 'aktualisierungsfehler' : 'aktualisiert'}`);
  }

  let onboardingError: string | undefined;
  if (params.neu === '1') {
    const result = await invokeConnect({ action: 'onboarding', ...paymentReturnUrls() });
    if (result.result?.url) redirect(result.result.url);
    onboardingError = result.error ?? p.onboardingLinkFailed;
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
          {p.statusUpdated}
        </p>
      ) : params.status === 'aktualisierungsfehler' ? (
        <p
          role="alert"
          className="mb-5 rounded-card bg-status-warning-subtle px-4 py-3 text-callout text-status-warning-on-subtle"
        >
          {p.statusUpdateFailed}
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
          {p.account}
        </h2>
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-subhead font-semibold text-text-primary">
              {p.accountStatus[accountStatus]}
            </p>
            <p className="mt-1 max-w-2xl text-callout text-text-secondary">
              {accountStatus === 'aktiv' ? p.accountActive : p.accountSetup}
            </p>
            {data.account && data.account.requirements_due.length > 0 ? (
              <p className="mt-2 text-footnote text-status-warning-text">{p.requirementsDue}</p>
            ) : null}
          </div>
          {accountStatus === 'aktiv' ? <StripeDashboardButton /> : <OnboardingButton />}
        </Card>
      </section>

      <section aria-labelledby="buchungen">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="buchungen" className="text-headline text-text-primary">
              {p.bookings}
            </h2>
            <p className="mt-1 text-callout text-text-secondary">{p.bookingsIntro}</p>
          </div>
          {data.offers.length > 0 ? (
            <form method="get" className="flex items-end gap-2">
              <label htmlFor="angebot" className="text-footnote text-text-secondary">
                {p.offer}
                <select
                  id="angebot"
                  name="angebot"
                  defaultValue={selectedOffer}
                  className="mt-1 block min-h-11 max-w-xs rounded-input border border-border-default bg-surface-default px-3 text-body text-text-primary"
                >
                  <option value="">{p.allOffers}</option>
                  {data.offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonClass('secondary', 'px-4')}>
                {p.filter}
              </button>
            </form>
          ) : null}
        </div>
        <BookingRows bookings={bookings} i18n={i18n} />
      </section>
      <p className="mt-5 text-footnote text-text-tertiary">{p.footnote}</p>
    </>
  );
}

export default async function PayoutsPage(props: PageProps) {
  const { t } = await getT();
  return (
    <>
      <h1 className="mb-2 text-title2 text-text-primary">{t.payments.title}</h1>
      <p className="mb-6 max-w-2xl text-callout text-text-secondary">{t.payments.intro}</p>
      <Suspense fallback={<p className="text-callout text-text-tertiary">{t.payments.loading}</p>}>
        <PayoutContent {...props} />
      </Suspense>
    </>
  );
}
