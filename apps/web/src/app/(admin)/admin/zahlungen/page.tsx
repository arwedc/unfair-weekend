import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminDashboard } from '@/components/zahlungen/admin-dashboard';

export const metadata: Metadata = { title: 'Zahlungen verwalten' };

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={<p className="text-callout text-text-tertiary">Zahlungsübersicht wird geladen …</p>}
    >
      <AdminDashboard />
    </Suspense>
  );
}
