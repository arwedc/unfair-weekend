import Link from 'next/link';
import { Suspense } from 'react';
import { logout } from '@/app/actions';
import { Logo } from '@/components/logo';
import { Button, buttonClass } from '@/components/ui';
import { LOCATION_STATUS_LABELS } from '@repo/shared';
import { requireAccount } from '@/lib/auth';

async function LocationName() {
  const { location } = await requireAccount();
  return (
    <span className="hidden text-subhead text-text-secondary sm:inline">
      {location.name}
      {location.status !== 'approved' && (
        <span className="ml-2 rounded-badge bg-accent-subtle px-1.5 py-0.5 text-caption text-accent-on-subtle">
          {LOCATION_STATUS_LABELS[location.status]}
        </span>
      )}
    </span>
  );
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
            <nav aria-label="Portal" className="flex items-center gap-1">
              <Link href="/angebote" className={buttonClass('ghost', 'px-3')}>
                Angebote
              </Link>
              <Link href="/vorlagen" className={buttonClass('ghost', 'px-3')}>
                Vorlagen
              </Link>
              <Link href="/auszahlungen" className={buttonClass('ghost', 'px-3')}>
                Auszahlungen
              </Link>
              <Link href="/profil" className={buttonClass('ghost', 'px-3')}>
                Profil
              </Link>
            </nav>
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
