import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import { Logo } from '@/components/logo';
import { Card } from '@/components/ui';
import { getT } from '@/lib/i18n/locale';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.common.login.title };
}

async function ReasonNotice({ searchParams }: { searchParams: Promise<{ grund?: string }> }) {
  const [{ grund }, { t }] = await Promise.all([searchParams, getT()]);
  const reasons: Record<string, string> = {
    'kein-standort': t.common.login.reasonNoLocation,
    'kein-admin': t.common.login.reasonNoAdmin,
  };
  const text = grund ? reasons[grund] : undefined;
  if (!text) return null;
  return (
    <p className="mb-4 rounded-card bg-accent-subtle px-4 py-3 text-callout text-accent-on-subtle">
      {text}
    </p>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ grund?: string }>;
}) {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-4 flex justify-end">
        <LocaleSwitcher />
      </div>
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-title2 text-text-primary">{t.common.login.heading}</h1>
        <p className="mt-2 text-callout text-text-secondary">{t.common.login.intro}</p>
      </div>
      <Suspense fallback={null}>
        <ReasonNotice searchParams={searchParams} />
      </Suspense>
      <Card className="p-6">
        <LoginForm />
      </Card>
      {process.env.NODE_ENV !== 'production' && (
        <p className="mt-6 text-center text-footnote text-text-tertiary">
          {t.common.login.devHintBefore} <code>seed-kochwerk-altstadt@example.com</code>{' '}
          {t.common.login.devHintMiddle} <code>SEED_TEST_PASSWORD</code>{' '}
          {t.common.login.devHintAfter}
        </p>
      )}
    </main>
  );
}
