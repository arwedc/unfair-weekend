import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logout } from '@/app/actions';
import { Button, Card } from '@/components/ui';
import { getMyAccount } from '@/lib/auth';

export const metadata: Metadata = { title: 'Partnerantrag' };

export default async function ApplicationStatusPage() {
  const account = await getMyAccount();
  if (account?.role !== 'standort') redirect('/login');
  const location = account.location;
  if (!location) redirect('/registrieren');

  const approved = location.status === 'approved';
  const rejected = location.status === 'rejected';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-title2 text-text-primary">
          {approved
            ? 'Unternehmen freigeschaltet'
            : rejected
              ? 'Antrag abgelehnt'
              : 'Antrag wird geprüft'}
        </h1>
        <p className="mt-2 text-callout text-text-secondary">
          {location.company_name} · {location.name}
        </p>
      </div>
      <Card className="space-y-4 p-6 sm:p-8">
        {approved ? (
          <>
            <p className="text-body text-text-primary">
              Dein Standort ist freigeschaltet. Du kannst jetzt Angebote veröffentlichen.
            </p>
            <Link
              href="/angebote"
              className="inline-flex text-subhead font-semibold text-accent-solid underline"
            >
              Zum Partnerportal
            </Link>
          </>
        ) : rejected ? (
          <>
            <p className="text-body text-text-primary">
              Wir können den Standort aktuell nicht aufnehmen.
            </p>
            {location.status_reason ? (
              <p className="rounded-input bg-background-muted p-3 text-callout text-text-secondary">
                {location.status_reason}
              </p>
            ) : null}
            <p className="text-callout text-text-secondary">
              Bei Rückfragen erreichst du uns über die bekannten Kontaktwege.
            </p>
          </>
        ) : (
          <>
            <p className="text-body text-text-primary">
              Danke für deinen Antrag. Wir prüfen die Angaben und melden uns bei Rückfragen
              telefonisch.
            </p>
            <p className="text-callout text-text-secondary">
              Bis zur Freischaltung kannst du noch keine Angebote veröffentlichen.
            </p>
          </>
        )}
        <form action={logout}>
          <Button type="submit" variant="ghost">
            Abmelden
          </Button>
        </form>
      </Card>
    </main>
  );
}
