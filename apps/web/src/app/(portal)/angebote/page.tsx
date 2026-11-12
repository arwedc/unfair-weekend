import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OFFER_CATEGORY_LABELS, OFFER_TYPE_LABELS } from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { OfferStatusBadge, OfferTime } from '@/components/offers/offer-meta';
import { buttonClass, Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { listMyOffers, type Offer } from '@/lib/offers/queries';

export const metadata: Metadata = { title: 'Meine Angebote' };

function OfferRow({ offer }: { offer: Offer }) {
  const free = offer.capacity - offer.seats_taken;
  const inactive = offer.status !== 'aktiv';
  return (
    <Link href={`/angebote/${offer.id}`} className="block rounded-card focus-visible:outline-2">
      <Card
        className={`flex flex-col gap-3 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${
          inactive ? 'opacity-70' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
            <OfferStatusBadge status={offer.status} />
            <span>{OFFER_CATEGORY_LABELS[offer.category]}</span>
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
              {formatPrice(offer.deal_price_cents)}{' '}
              <span className="text-footnote text-text-tertiary line-through">
                {formatPrice(offer.original_price_cents)}
              </span>
            </p>
            <p className="text-footnote text-text-secondary">
              {free} von {offer.capacity} Plätzen frei
            </p>
          </div>
          <span className="rounded-badge bg-badge-deal-background px-2 py-1 text-caption font-bold text-badge-deal-foreground">
            {formatDiscount(discountPercent(offer.original_price_cents, offer.deal_price_cents))}
          </span>
        </div>
      </Card>
    </Link>
  );
}

async function OfferList() {
  await requireAccount();
  const offers = await listMyOffers();

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

export default function OffersPage() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-title2 text-text-primary">Meine Angebote</h1>
        <Link href="/angebote/neu" className={buttonClass('primary')}>
          Neues Angebot
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">Angebote werden geladen …</p>}
      >
        <OfferList />
      </Suspense>
    </>
  );
}
