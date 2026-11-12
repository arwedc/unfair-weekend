import type { Metadata } from 'next';
import { Logo } from '@/components/logo';
import { Card } from '@/components/ui';
import { listDemoLogins, MOCK_PASSWORD } from '@/lib/mock/data';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Anmelden' };

export default function LoginPage() {
  const demoLogins = listDemoLogins();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-title2 text-text-primary">Partner-Login</h1>
        <p className="mt-2 text-callout text-text-secondary">
          Melde dich mit dem Zugang deines Standorts an.
        </p>
      </div>

      <Card className="p-6">
        <LoginForm />
      </Card>

      <div className="mt-6 rounded-card border border-dashed border-border-strong p-4 text-footnote text-text-secondary">
        <p className="font-semibold text-text-primary">Demo-Zugänge (Mock)</p>
        <ul className="mt-2 space-y-1">
          {demoLogins.map((login) => (
            <li key={login.email}>
              <code>{login.email}</code> · {login.name}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Passwort: <code>{MOCK_PASSWORD}</code>
        </p>
      </div>
    </main>
  );
}
