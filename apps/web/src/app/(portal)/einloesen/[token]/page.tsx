import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { formatDateTime } from '@repo/shared/utils';
import { RedeemToken } from '@/components/checkin/redeem-token';
import { VoucherStatusBadge } from '@/components/checkin/voucher-status-badge';
import { OfferTime } from '@/components/offers/offer-meta';
import { buttonClass, Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getVoucherByToken } from '@/lib/checkin/queries';
import { getT } from '@/lib/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.checkin.token.title };
}

interface PageProps {
  params: Promise<{ token: string }>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-callout text-text-secondary">{label}</dt>
      <dd className="text-right text-callout text-text-primary">{children}</dd>
    </div>
  );
}

/**
 * Ziel des QR-Codes aus der App. Zeigt den Code nur an, eingelöst wird per Button.
 */
async function TokenDetail({ params }: PageProps) {
  const { token } = await params;
  await requireAccount(`/einloesen/${encodeURIComponent(token)}`);
  const [{ locale, t }, voucher] = await Promise.all([getT(), getVoucherByToken(token)]);
  const m = t.checkin.token;

  if (!voucher) {
    return (
      <Card className="p-6">
        <h2 className="text-headline text-text-primary">{m.notFoundTitle}</h2>
        <p className="mt-1 text-callout text-text-secondary">{m.notFoundText}</p>
        <Link href="/einloesen" className={`${buttonClass('secondary')} mt-4`}>
          {m.enterShortCode}
        </Link>
      </Card>
    );
  }

  const now = new Date();
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-title3 text-text-primary">
          {voucher.guestName ?? t.checkin.guests.deletedAccount}
        </h2>
        <VoucherStatusBadge status={voucher.status} locale={locale} />
      </div>
      <dl className="mb-6 mt-3 divide-y divide-border-subtle">
        <Row label={m.offer}>
          {voucher.offer.title}
          <span className="block text-footnote text-text-secondary">
            <OfferTime offer={voucher.offer} locale={locale} />
          </span>
        </Row>
        <Row label={m.seatsLabel}>{t.checkin.seats(voucher.seats)}</Row>
        <Row label={m.shortCode}>{voucher.shortCode}</Row>
      </dl>
      <RedeemToken
        token={token}
        offerId={voucher.offer.id}
        status={voucher.status}
        redeemedLabel={voucher.redeemedAt ? formatDateTime(voucher.redeemedAt, now, locale) : null}
      />
    </Card>
  );
}

export default async function RedeemTokenPage(props: PageProps) {
  const { t } = await getT();
  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-title2 text-text-primary">{t.checkin.token.title}</h1>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">{t.checkin.token.loading}</p>}
      >
        <TokenDetail {...props} />
      </Suspense>
    </div>
  );
}
