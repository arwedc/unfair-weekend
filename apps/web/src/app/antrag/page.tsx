import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logout } from '@/app/actions';
import { Button, Card } from '@/components/ui';
import { getMyAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.onboarding.application.title };
}

export default async function ApplicationStatusPage() {
  const [account, { t }] = await Promise.all([getMyAccount(), getT()]);
  if (account?.role !== 'standort') redirect('/login');
  const location = account.location;
  if (!location) redirect('/registrieren');

  const m = t.onboarding.application;
  const approved = location.status === 'approved';
  const rejected = location.status === 'rejected';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-title2 text-text-primary">
          {approved ? m.approvedHeading : rejected ? m.rejectedHeading : m.pendingHeading}
        </h1>
        <p className="mt-2 text-callout text-text-secondary">
          {location.company_name} · {location.name}
        </p>
      </div>
      <Card className="space-y-4 p-6 sm:p-8">
        {approved ? (
          <>
            <p className="text-body text-text-primary">{m.approvedText}</p>
            <Link
              href="/angebote"
              className="inline-flex text-subhead font-semibold text-accent-solid underline"
            >
              {m.toPortal}
            </Link>
          </>
        ) : rejected ? (
          <>
            <p className="text-body text-text-primary">{m.rejectedText}</p>
            {location.status_reason ? (
              <p className="rounded-input bg-background-muted p-3 text-callout text-text-secondary">
                {location.status_reason}
              </p>
            ) : null}
            <p className="text-callout text-text-secondary">{m.rejectedContact}</p>
          </>
        ) : (
          <>
            <p className="text-body text-text-primary">{m.pendingText}</p>
            <p className="text-callout text-text-secondary">{m.pendingHint}</p>
          </>
        )}
        <form action={logout}>
          <Button type="submit" variant="ghost">
            {t.common.nav.logout}
          </Button>
        </form>
      </Card>
    </main>
  );
}
