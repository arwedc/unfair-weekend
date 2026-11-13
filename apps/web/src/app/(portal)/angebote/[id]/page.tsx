import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OfferForm } from '@/components/offers/offer-form';
import { CancelOffer } from '@/components/offers/cancel-offer';
import { OfferStatusBadge, OfferTime } from '@/components/offers/offer-meta';
import { Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { offerToFormValues } from '@/lib/offers/form';
import { getMinDiscountPercent, getMyOffer, offerHasCodes } from '@/lib/offers/queries';
import { cancelOfferAction, updateOfferAction } from '../actions';

export const metadata: Metadata = { title: 'Angebot bearbeiten' };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ abgesagt?: string }>;
}

async function OfferDetail({ params, searchParams }: PageProps) {
  const [{ location }, { id }, { abgesagt }] = await Promise.all([
    requireAccount(),
    params,
    searchParams,
  ]);
  const offer = await getMyOffer(id);
  if (!offer) notFound();

  const header = (
    <div className="mb-6 mt-2">
      <div className="flex items-center gap-2">
        <OfferStatusBadge status={offer.status} />
        <span className="text-subhead text-text-secondary">
          <OfferTime offer={offer} />
        </span>
      </div>
      <h1 className="mt-1 text-title2 text-text-primary">{offer.title}</h1>
      <p className="mt-1 text-subhead text-text-secondary">
        {offer.seats_taken} von {offer.capacity} Plätzen vergeben
      </p>
      <Link
        href={`/vorlagen/neu?angebot=${offer.id}`}
        className="mt-2 inline-block text-subhead text-text-link hover:underline"
      >
        Als Vorlage speichern
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
            Angebot abgesagt.{' '}
            {abgesagt === '0'
              ? 'Es gab keine aktiven Codes.'
              : `${abgesagt} aktive Codes wurden storniert, die Inhaber werden benachrichtigt.`}
          </p>
        )}
        <Card className="p-6">
          <p className="text-callout text-text-secondary">
            Dieses Angebot ist {offer.status === 'abgesagt' ? 'abgesagt' : 'entfernt'} und kann
            nicht mehr bearbeitet werden.
          </p>
          {offer.status_reason && (
            <p className="mt-2 text-callout text-text-primary">Grund: {offer.status_reason}</p>
          )}
        </Card>
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
      <OfferForm
        mode="edit"
        action={updateOfferAction.bind(null, offer.id)}
        locationId={location.id}
        initialValues={offerToFormValues(offer)}
        minDiscountPercent={minDiscountPercent}
        hasCodes={hasCodes}
        seatsTaken={offer.seats_taken}
      />
      <CancelOffer action={cancelOfferAction.bind(null, offer.id)} seatsTaken={offer.seats_taken} />
    </>
  );
}

export default function OfferPage(props: PageProps) {
  return (
    <>
      <Link href="/angebote" className="text-subhead text-text-link hover:underline">
        ← Zurück zur Übersicht
      </Link>
      <Suspense
        fallback={<p className="mt-4 text-callout text-text-tertiary">Angebot wird geladen …</p>}
      >
        <OfferDetail {...props} />
      </Suspense>
    </>
  );
}
