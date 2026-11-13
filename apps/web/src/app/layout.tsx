import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import { LocaleProvider } from '@/lib/i18n/context';
import { getT } from '@/lib/i18n/locale';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t.common.appTitle, template: '%s · unfair weekend' },
    description: t.common.appDescription,
  };
}

/** Die Sprache hängt am Cookie, deshalb wird alles darunter zur Anfragezeit gerendert. */
async function LocaleRoot({ children }: { children: React.ReactNode }) {
  const { locale } = await getT();
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Suspense fallback={null}>
          <LocaleRoot>{children}</LocaleRoot>
        </Suspense>
      </body>
    </html>
  );
}
