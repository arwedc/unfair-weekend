import { Suspense } from 'react';
import { AdminDashboard } from '@/components/zahlungen/admin-dashboard';
import { getT } from '@/lib/i18n/locale';

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.admin.title };
}

export default async function AdminPaymentsPage() {
  const { t } = await getT();
  return (
    <Suspense fallback={<p className="text-callout text-text-tertiary">{t.common.loading}</p>}>
      <AdminDashboard />
    </Suspense>
  );
}
