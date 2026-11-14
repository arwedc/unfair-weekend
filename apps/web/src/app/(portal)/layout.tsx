import Link from 'next/link';
import type { ReactNode } from 'react';
import { logout } from '@/app/actions';
import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import {
  CheckinIcon,
  LogoutIcon,
  OffersIcon,
  PayoutsIcon,
  ProfileIcon,
  ReviewsIcon,
  TemplatesIcon,
} from '@/components/nav-icons';
import { Button, buttonClass } from '@/components/ui';
import { getT } from '@/lib/i18n/locale';

function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass('ghost', 'px-3')}>
      {icon}
      {children}
    </Link>
  );
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  const nav = t.common.nav;
  return (
    <div className="min-h-screen">
      <header className="border-b border-border-subtle bg-surface-default">
        {/*
          Das Menü liegt in derselben Spalte wie der Seiteninhalt (max-w-4xl, px-4), damit
          „Angebote“ links und „Profil“ rechts mit dem Inhalt fluchten. Ab xl stehen Sprache
          und Abmelden rechts außerhalb dieser Spalte, darunter rücken sie in die Spalte.
          Das -mx-3 bzw. mx-1 gleicht das Padding der Ghost-Buttons aus.
        */}
        <div className="mx-auto flex min-h-16 max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 xl:grid xl:max-w-none xl:grid-cols-[1fr_minmax(0,56rem)_1fr] xl:px-0">
          <nav
            aria-label={nav.portal}
            className="-mx-3 flex flex-wrap items-center gap-1 xl:col-start-2 xl:mx-1 xl:justify-between"
          >
            <NavLink href="/angebote" icon={<OffersIcon />}>
              {nav.offers}
            </NavLink>
            <NavLink href="/einloesen" icon={<CheckinIcon />}>
              {nav.checkin}
            </NavLink>
            <NavLink href="/vorlagen" icon={<TemplatesIcon />}>
              {nav.templates}
            </NavLink>
            <NavLink href="/bewertungen" icon={<ReviewsIcon />}>
              {nav.reviews}
            </NavLink>
            <NavLink href="/auszahlungen" icon={<PayoutsIcon />}>
              {nav.payouts}
            </NavLink>
            <NavLink href="/profil" icon={<ProfileIcon />}>
              {nav.profile}
            </NavLink>
          </nav>
          <div className="flex items-center gap-2 xl:col-start-3 xl:justify-self-end xl:pr-4">
            <LocaleSwitcher />
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                className="px-3"
                title={nav.logout}
                aria-label={nav.logout}
              >
                <LogoutIcon />
                <span className="hidden min-[1360px]:inline">{nav.logout}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
