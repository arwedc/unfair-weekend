import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Card } from '@/components/ui';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Partner werden' };

export default function PartnerSignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-title2 text-text-primary">Partnerkonto erstellen</h1>
        <p className="mt-2 text-callout text-text-secondary">
          Lege zuerst deinen Zugang an. Danach kannst du dein Unternehmen und den Standort
          eintragen.
        </p>
      </div>
      <Card className="p-6">
        <SignUpForm />
      </Card>
      <p className="mt-5 text-center text-callout text-text-secondary">
        Schon registriert?{' '}
        <Link href="/login" className="font-semibold text-accent-solid underline">
          Zum Login
        </Link>
      </p>
    </main>
  );
}
