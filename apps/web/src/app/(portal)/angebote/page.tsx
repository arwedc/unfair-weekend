import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { OfferStatusBadge, OfferTime } from '@/components/offers/offer-meta';
import { buttonClass, Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { listMyOffers, type Offer } from '@/lib/offers/queries';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.offers.listTitle };
}

type I18n = Awaited<ReturnType<typeof getT>>;

function OfferRow({ offer, i18n }: { offer: Offer; i18n: I18n }) {
  const { locale, t, labels } = i18n;
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
            <OfferStatusBadge status={offer.status} locale={locale} />
            <span>{labels.offerCategory[offer.category]}</span>
            <span aria-hidden>·</span>
            <span>{labels.offerType[offer.type]}</span>
          </div>
          <h2 className="mt-1 truncate text-headline text-text-primary">{offer.title}</h2>
          <p className="mt-0.5 text-subhead text-text-secondary">
            <OfferTime offer={offer} locale={locale} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:text-right">
          <div>
            <p className="text-body-strong text-text-primary">
              {formatPrice(offer.deal_price_cents, { locale })}{' '}
              <span className="text-footnote text-text-tertiary line-through">
                {formatPrice(offer.original_price_cents, { locale })}
              </span>
            </p>
            <p className="text-footnote text-text-secondary">
              {t.offers.seatsFree(free, offer.capacity)}
            </p>
          </div>
          <span className="rounded-badge bg-badge-deal-background px-2 py-1 text-caption font-bold text-badge-deal-foreground">
            {formatDiscount(
              discountPercent(offer.original_price_cents, offer.deal_price_cents),
              locale,
            )}
          </span>
        </div>
      </Card>
    </Link>
  );
}

async function OfferList() {
  await requireAccount();
  const [offers, i18n] = await Promise.all([listMyOffers(), getT()]);
  const { t } = i18n;

  if (offers.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-headline text-text-primary">{t.offers.emptyTitle}</p>
        <p className="mt-1 text-callout text-text-secondary">{t.offers.emptyText}</p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {offers.map((offer) => (
        <li key={offer.id}>
          <OfferRow offer={offer} i18n={i18n} />
        </li>
      ))}
    </ul>
  );
}

export default async function OffersPage() {
  const { t } = await getT();
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-title2 text-text-primary">{t.offers.listTitle}</h1>
        <Link href="/angebote/neu" className={buttonClass('primary')}>
          {t.offers.newOffer}
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">{t.offers.listLoading}</p>}
      >
        <OfferList />
      </Suspense>
    </>
  );
}
