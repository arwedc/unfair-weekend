import Link from 'next/link';
import { Suspense } from 'react';
import { logout } from '@/app/actions';
import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import { Logo } from '@/components/logo';
import { Button, buttonClass } from '@/components/ui';
import { getT } from '@/lib/i18n/locale';
import { requirePaymentAdmin } from '@/lib/zahlungen/auth';

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requirePaymentAdmin();
  return children;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-surface-default">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <Link href="/admin/zahlungen" aria-label={t.common.nav.toPayments}>
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <nav aria-label={t.common.nav.admin} className="flex items-center gap-1">
              <Link href="/admin/zahlungen" className={buttonClass('ghost', 'px-3')}>
                {t.common.nav.payments}
              </Link>
            </nav>
            <LocaleSwitcher />
            <form action={logout}>
              <Button type="submit" variant="ghost">
                {t.common.nav.logout}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Suspense
          fallback={<p className="text-callout text-text-tertiary">{t.common.nav.adminLoading}</p>}
        >
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
