import Link from 'next/link';
import { Suspense } from 'react';
import { logout } from '@/app/actions';
import { Logo } from '@/components/logo';
import { Button, buttonClass } from '@/components/ui';
import { requirePaymentAdmin } from '@/lib/zahlungen/auth';

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requirePaymentAdmin();
  return children;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-surface-default">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <Link href="/admin/zahlungen" aria-label="Zur Zahlungsverwaltung">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <nav aria-label="Admin" className="flex items-center gap-1">
              <Link href="/admin/zahlungen" className={buttonClass('ghost', 'px-3')}>
                Zahlungen
              </Link>
            </nav>
            <form action={logout}>
              <Button type="submit" variant="ghost">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Suspense
          fallback={<p className="text-callout text-text-tertiary">Admin-Bereich wird geladen …</p>}
        >
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
