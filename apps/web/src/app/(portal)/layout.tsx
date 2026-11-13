import Link from 'next/link';
import { Suspense } from 'react';
import { logout } from '@/app/actions';
import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import { Logo } from '@/components/logo';
import { Button, buttonClass } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';

async function LocationName() {
  const [{ location }, { labels }] = await Promise.all([requireAccount(), getT()]);
  return (
    <span className="hidden text-subhead text-text-secondary sm:inline">
      {location.name}
      {location.status !== 'approved' && (
        <span className="ml-2 rounded-badge bg-accent-subtle px-1.5 py-0.5 text-caption text-accent-on-subtle">
          {labels.locationStatus[location.status]}
        </span>
      )}
    </span>
  );
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  const nav = t.common.nav;
  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-surface-default">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link href="/angebote" aria-label={nav.toOverview}>
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <nav aria-label={nav.portal} className="flex items-center gap-1">
              <Link href="/angebote" className={buttonClass('ghost', 'px-3')}>
                {nav.offers}
              </Link>
              <Link href="/vorlagen" className={buttonClass('ghost', 'px-3')}>
                {nav.templates}
              </Link>
              <Link href="/bewertungen" className={buttonClass('ghost', 'px-3')}>
                {nav.reviews}
              </Link>
              <Link href="/auszahlungen" className={buttonClass('ghost', 'px-3')}>
                {nav.payouts}
              </Link>
              <Link href="/profil" className={buttonClass('ghost', 'px-3')}>
                {nav.profile}
              </Link>
            </nav>
            <Suspense fallback={null}>
              <LocationName />
            </Suspense>
            <LocaleSwitcher />
            <form action={logout}>
              <Button type="submit" variant="ghost">
                {nav.logout}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
