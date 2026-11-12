import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { requireSession } from '@/lib/auth';
import { OfferForm } from './offer-form';

export const metadata: Metadata = { title: 'Neues Angebot' };

async function FormWithLocation() {
  const location = await requireSession();
  return <OfferForm defaultAddress={location.address} />;
}

export default function NewOfferPage() {
  return (
    <>
      <Link href="/angebote" className="text-subhead text-text-link hover:underline">
        ← Zurück zur Übersicht
      </Link>
      <h1 className="mt-3 text-title2 text-text-primary">Neues Angebot</h1>
      <p className="mt-1 mb-6 text-callout text-text-secondary">
        Kurzfristig, vergünstigt, ohne Gebühren. Nutzer sichern sich Plätze per Gutscheincode.
      </p>
      <Suspense fallback={<p className="text-callout text-text-tertiary">Lädt …</p>}>
        <FormWithLocation />
      </Suspense>
    </>
  );
}
