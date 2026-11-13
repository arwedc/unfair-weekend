import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RedeemForm } from '@/components/checkin/redeem-form';
import { Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.checkin.title };
}

async function RedeemCard() {
  await requireAccount('/einloesen');
  return (
    <Card className="p-6">
      <RedeemForm />
    </Card>
  );
}

/** Kurzcode von Hand eingeben (z. B. wenn der Gast keinen QR-Code zeigen kann). */
export default async function RedeemPage() {
  const { t } = await getT();
  return (
    <div className="max-w-xl">
      <h1 className="text-title2 text-text-primary">{t.checkin.title}</h1>
      <p className="mb-6 mt-1 text-callout text-text-secondary">{t.checkin.intro}</p>
      <Suspense fallback={<p className="text-callout text-text-tertiary">{t.common.loading}</p>}>
        <RedeemCard />
      </Suspense>
    </div>
  );
}
