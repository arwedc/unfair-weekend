import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Card } from '@/components/ui';
import { getMyAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { RegistrationForm } from './registration-form';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.onboarding.registration.title };
}

export default async function RegistrationPage() {
  const [account, { t }] = await Promise.all([getMyAccount(), getT()]);
  if (account?.role !== 'standort') redirect('/login');
  if (account.location) redirect('/antrag');
  const m = t.onboarding.registration;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-title2 text-text-primary">{m.title}</h1>
        <p className="mt-2 text-callout text-text-secondary">{m.intro}</p>
      </div>
      <Card className="p-6 sm:p-8">
        <RegistrationForm />
      </Card>
    </main>
  );
}
