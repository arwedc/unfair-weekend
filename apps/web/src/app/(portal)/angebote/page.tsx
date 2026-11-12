import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OFFER_TYPE_LABELS } from '@repo/shared';
import {
  discountPercent,
  formatDateRange,
  formatDiscount,
  formatPrice,
  formatTimeRange,
} from '@repo/shared/utils';
import { buttonClass, Card } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import { listOffers, type Offer } from '@/lib/mock/data';

export const metadata: Metadata = { title: 'Meine Angebote' };

function OfferTime({ offer }: { offer: Offer }) {
  return offer.type === 'einzeltermin'
    ? formatTimeRange(offer.startsAt, offer.endsAt)
    : formatDateRange(offer.startsAt, offer.endsAt);
}

function OfferRow({ offer }: { offer: Offer }) {
  const free = offer.capacity - offer.claimedSeats;
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
          <span>{offer.category}</span>
          <span aria-hidden>·</span>
          <span>{OFFER_TYPE_LABELS[offer.type]}</span>
        </div>
        <h2 className="mt-1 truncate text-headline text-text-primary">{offer.title}</h2>
        <p className="mt-0.5 text-subhead text-text-secondary">
          <OfferTime offer={offer} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4 sm:text-right">
        <div>
          <p className="text-body-strong text-text-primary">
            {formatPrice(offer.dealPriceCents)}{' '}
            <span className="text-footnote text-text-tertiary line-through">
              {formatPrice(offer.originalPriceCents)}
            </span>
          </p>
          <p className="text-footnote text-text-secondary">
            {free} von {offer.capacity} Plätzen frei
          </p>
        </div>
        <span className="rounded-badge bg-badge-deal-background px-2 py-1 text-caption font-bold text-badge-deal-foreground">
          {formatDiscount(discountPercent(offer.originalPriceCents, offer.dealPriceCents))}
        </span>
      </div>
    </Card>
  );
}

async function OfferList() {
  const location = await requireSession();
  const offers = await listOffers(location.id);

  if (offers.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-headline text-text-primary">Noch keine Angebote</p>
        <p className="mt-1 text-callout text-text-secondary">
          Leg dein erstes Angebot an. Es ist sofort in der App sichtbar.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {offers.map((offer) => (
        <li key={offer.id}>
          <OfferRow offer={offer} />
        </li>
      ))}
    </ul>
  );
}

async function CreatedNotice({ searchParams }: { searchParams: Promise<{ neu?: string }> }) {
  const { neu } = await searchParams;
  if (neu !== '1') return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-card bg-status-success-subtle px-4 py-3 text-subhead text-status-success-on-subtle"
    >
      Angebot angelegt.
    </p>
  );
}

export default function OffersPage({ searchParams }: PageProps<'/angebote'>) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-title2 text-text-primary">Meine Angebote</h1>
        <Link href="/angebote/neu" className={buttonClass('primary')}>
          Neues Angebot
        </Link>
      </div>
      <Suspense fallback={null}>
        <CreatedNotice searchParams={searchParams as Promise<{ neu?: string }>} />
      </Suspense>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">Angebote werden geladen …</p>}
      >
        <OfferList />
      </Suspense>
    </>
  );
}
