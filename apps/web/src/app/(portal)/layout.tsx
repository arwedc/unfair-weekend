import Link from 'next/link';
import { Suspense } from 'react';
import { logout } from '@/app/actions';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui';
import { requireSession } from '@/lib/auth';

async function LocationName() {
  const location = await requireSession();
  return <span className="hidden text-subhead text-text-secondary sm:inline">{location.name}</span>;
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-surface-default">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link href="/angebote" aria-label="Zur Übersicht">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <LocationName />
            </Suspense>
            <form action={logout}>
              <Button type="submit" variant="ghost">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
