import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Logo } from '@/components/logo';
import { Card } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Anmelden' };

const REASONS: Record<string, string> = {
  'kein-standort':
    'Dieses Konto gehört zu keinem Standort. Die Website ist nur für Partner. Bitte mit dem Standort-Zugang anmelden.',
  'kein-admin': 'Dieses Konto hat keinen Admin-Zugang.',
};

async function ReasonNotice({ searchParams }: { searchParams: Promise<{ grund?: string }> }) {
  const { grund } = await searchParams;
  const text = grund ? REASONS[grund] : undefined;
  if (!text) return null;
  return (
    <p className="mb-4 rounded-card bg-accent-subtle px-4 py-3 text-callout text-accent-on-subtle">
      {text}
    </p>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ grund?: string }> }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-title2 text-text-primary">Partner-Login</h1>
        <p className="mt-2 text-callout text-text-secondary">
          Melde dich mit dem Zugang deines Standorts an.
        </p>
      </div>
      <Suspense fallback={null}>
        <ReasonNotice searchParams={searchParams} />
      </Suspense>
      <Card className="p-6">
        <LoginForm />
      </Card>
      <p className="mt-5 text-center text-callout text-text-secondary">
        Du möchtest mit deinem Unternehmen dabei sein?{' '}
        <Link href="/partner-werden" className="font-semibold text-accent-solid underline">
          Partnerkonto erstellen
        </Link>
      </p>
      {process.env.NODE_ENV !== 'production' && (
        <p className="mt-6 text-center text-footnote text-text-tertiary">
          Entwicklung: Seed-Zugänge wie <code>seed-kochwerk-altstadt@example.com</code> mit dem
          Passwort aus <code>SEED_TEST_PASSWORD</code> (siehe docs/BACKEND.md).
        </p>
      )}
    </main>
  );
}
