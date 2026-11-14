import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Card } from '@/components/ui';
import { getT } from '@/lib/i18n/locale';
import { SignUpForm } from './sign-up-form';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.onboarding.signUp.title };
}

export default async function PartnerSignUpPage() {
  const { t } = await getT();
  const m = t.onboarding.signUp;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-title2 text-text-primary">{m.heading}</h1>
        <p className="mt-2 text-callout text-text-secondary">{m.intro}</p>
      </div>
      <Card className="p-6">
        <SignUpForm />
      </Card>
      <p className="mt-5 text-center text-callout text-text-secondary">
        {m.alreadyRegistered}{' '}
        <Link href="/login" className="font-semibold text-accent-solid underline">
          {m.toLogin}
        </Link>
      </p>
    </main>
  );
}
