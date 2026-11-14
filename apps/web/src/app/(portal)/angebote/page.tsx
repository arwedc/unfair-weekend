import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { OfferStatusBadge, OfferTime } from '@/components/offers/offer-meta';
import { buttonClass, Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { isOfferEnded, parseOfferView, splitOffers, type OfferView } from '@/lib/offers/archive';
import { listMyOffers, type Offer } from '@/lib/offers/queries';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.offers.listTitle };
}

type I18n = Awaited<ReturnType<typeof getT>>;

interface PageProps {
  searchParams: Promise<{ ansicht?: string }>;
}

function OfferRow({
  offer,
  archived,
  now,
  i18n,
}: {
  offer: Offer;
  archived: boolean;
  now: Date;
  i18n: I18n;
}) {
  const { locale, t, labels } = i18n;
  const free = offer.capacity - offer.seats_taken;
  return (
    <Link href={`/angebote/${offer.id}`} className="block rounded-card focus-visible:outline-2">
      <Card
        className={`flex flex-col gap-3 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${
          archived ? 'opacity-70' : ''
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
            <OfferStatusBadge
              status={offer.status}
              locale={locale}
              endedLabel={isOfferEnded(offer, now) ? t.offers.views.ended : undefined}
            />
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

function ViewTabs({
  view,
  counts,
  i18n,
}: {
  view: OfferView;
  counts: Record<OfferView, number>;
  i18n: I18n;
}) {
  const v = i18n.t.offers.views;
  const tabs: { key: OfferView; href: string; label: string }[] = [
    { key: 'aktuell', href: '/angebote', label: v.current },
    { key: 'archiv', href: '/angebote?ansicht=archiv', label: v.archive },
  ];
  return (
    <nav aria-label={v.label} className="mb-4 flex gap-1 border-b border-border-default">
      {tabs.map((tab) => {
        const active = tab.key === view;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-subhead transition-colors focus-visible:outline-2 focus-visible:outline-border-focus ${
              active
                ? 'border-accent-solid text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label} <span className="tabular-nums text-text-tertiary">{counts[tab.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-headline text-text-primary">{title}</p>
      <p className="mt-1 text-callout text-text-secondary">{text}</p>
    </Card>
  );
}

async function OfferList({ searchParams }: PageProps) {
  await requireAccount();
  const [offers, { ansicht }, i18n] = await Promise.all([listMyOffers(), searchParams, getT()]);
  const { t } = i18n;

  if (offers.length === 0) {
    return <EmptyState title={t.offers.emptyTitle} text={t.offers.emptyText} />;
  }

  const view = parseOfferView(ansicht);
  const now = new Date();
  const { current, archived } = splitOffers(offers, now);
  const shown = view === 'archiv' ? archived : current;
  const v = t.offers.views;

  return (
    <>
      <ViewTabs
        view={view}
        counts={{ aktuell: current.length, archiv: archived.length }}
        i18n={i18n}
      />
      {shown.length === 0 ? (
        view === 'archiv' ? (
          <EmptyState title={v.archiveEmptyTitle} text={v.archiveEmptyText} />
        ) : (
          <EmptyState title={v.currentEmptyTitle} text={v.currentEmptyText} />
        )
      ) : (
        <ul className="space-y-3">
          {shown.map((offer) => (
            <li key={offer.id}>
              <OfferRow offer={offer} archived={view === 'archiv'} now={now} i18n={i18n} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function OffersPage({ searchParams }: PageProps) {
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
        <OfferList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
