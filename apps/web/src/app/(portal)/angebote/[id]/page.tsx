import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Locale } from '@repo/shared/i18n';
import { formatDateTime } from '@repo/shared/utils';
import { GuestList, type Guest } from '@/components/checkin/guest-list';
import { OfferForm } from '@/components/offers/offer-form';
import { CancelOffer } from '@/components/offers/cancel-offer';
import { OfferStatusBadge, OfferTime } from '@/components/offers/offer-meta';
import { Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getParticipants, guestName, type Participant } from '@/lib/checkin/queries';
import { getT } from '@/lib/i18n/locale';
import { offerToFormValues } from '@/lib/offers/form';
import { getMinDiscountPercent, getMyOffer, offerHasCodes } from '@/lib/offers/queries';
import { cancelOfferAction, updateOfferAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.offers.editTitle };
}

/** Zeilen der Gästeliste, Zeiten schon in Europe/Berlin formatiert. */
function toGuests(participants: Participant[], locale: Locale): Guest[] {
  const now = new Date();
  return participants.map((p) => ({
    voucherId: p.voucher_id,
    shortCode: p.short_code,
    seats: p.seats,
    status: p.status,
    isPaid: p.is_paid,
    name: guestName(p),
    redeemedLabel: p.redeemed_at ? formatDateTime(p.redeemed_at, now, locale) : null,
  }));
}

/** Einzeltermin hat begonnen (Serverzeit). Die genaue Frist prüft `mark_no_show`. */
function noShowAvailable(offer: { type: string; starts_at: string }): boolean {
  return offer.type === 'einzeltermin' && Date.now() >= Date.parse(offer.starts_at);
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ abgesagt?: string }>;
}

async function OfferDetail({ params, searchParams }: PageProps) {
  const [, { id }, { abgesagt }, { locale, t }] = await Promise.all([
    requireAccount(),
    params,
    searchParams,
    getT(),
  ]);
  const offer = await getMyOffer(id);
  if (!offer) notFound();
  const participants = await getParticipants(offer.id);
  const guests = toGuests(participants, locale);
  const guestList = (readOnly: boolean) =>
    guests.length > 0 ? (
      <GuestList
        offerId={offer.id}
        guests={guests}
        readOnly={readOnly}
        canMarkNoShow={noShowAvailable(offer)}
      />
    ) : null;

  const header = (
    <div className="mb-6 mt-2">
      <div className="flex items-center gap-2">
        <OfferStatusBadge status={offer.status} locale={locale} />
        <span className="text-subhead text-text-secondary">
          <OfferTime offer={offer} locale={locale} />
        </span>
      </div>
      <h1 className="mt-1 text-title2 text-text-primary">{offer.title}</h1>
      <p className="mt-1 text-subhead text-text-secondary">
        {t.offers.seatsTaken(offer.seats_taken, offer.capacity)}
      </p>
      <Link
        href={`/vorlagen/neu?angebot=${offer.id}`}
        className="mt-2 inline-block text-subhead text-text-link hover:underline"
      >
        {t.offers.saveAsTemplate}
      </Link>
    </div>
  );

  if (offer.status !== 'aktiv') {
    return (
      <>
        {header}
        {abgesagt !== undefined && (
          <p
            role="status"
            className="mb-4 rounded-card bg-status-success-subtle px-4 py-3 text-callout text-status-success-on-subtle"
          >
            {t.offers.cancelled}{' '}
            {abgesagt === '0' ? t.offers.cancelledNone : t.offers.cancelledSome(Number(abgesagt))}
          </p>
        )}
        <Card className="p-6">
          <p className="text-callout text-text-secondary">
            {offer.status === 'abgesagt' ? t.offers.inactiveCancelled : t.offers.inactiveRemoved}
          </p>
          {offer.status_reason && (
            <p className="mt-2 text-callout text-text-primary">
              {t.common.reason(offer.status_reason)}
            </p>
          )}
        </Card>
        <div className="mt-8">{guestList(true)}</div>
      </>
    );
  }

  const [hasCodes, minDiscountPercent] = await Promise.all([
    offerHasCodes(offer.id),
    getMinDiscountPercent(),
  ]);

  return (
    <>
      {header}
      {guestList(false)}
      <OfferForm
        mode="edit"
        action={updateOfferAction.bind(null, offer.id)}
        initialValues={offerToFormValues(offer)}
        minDiscountPercent={minDiscountPercent}
        hasCodes={hasCodes}
        seatsTaken={offer.seats_taken}
      />
      <CancelOffer action={cancelOfferAction.bind(null, offer.id)} seatsTaken={offer.seats_taken} />
    </>
  );
}

export default async function OfferPage(props: PageProps) {
  const { t } = await getT();
  return (
    <>
      <Link href="/angebote" className="text-subhead text-text-link hover:underline">
        {t.common.backToOverview}
      </Link>
      <Suspense
        fallback={<p className="mt-4 text-callout text-text-tertiary">{t.offers.detailLoading}</p>}
      >
        <OfferDetail {...props} />
      </Suspense>
    </>
  );
}
