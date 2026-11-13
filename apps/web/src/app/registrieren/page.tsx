import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Card } from '@/components/ui';
import { getMyAccount } from '@/lib/auth';
import { RegistrationForm } from './registration-form';

export const metadata: Metadata = { title: 'Unternehmen registrieren' };

export default async function RegistrationPage() {
  const account = await getMyAccount();
  if (account?.role !== 'standort') redirect('/login');
  if (account.location) redirect('/antrag');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-title2 text-text-primary">Unternehmen registrieren</h1>
        <p className="mt-2 text-callout text-text-secondary">
          Trag die Unternehmens- und Standortdaten ein. Wir prüfen den Antrag persönlich.
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <RegistrationForm />
      </Card>
    </main>
  );
}
