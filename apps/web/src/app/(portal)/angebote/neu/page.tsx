import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OfferForm } from '@/components/offers/offer-form';
import { requireAccount } from '@/lib/auth';
import { getMinDiscountPercent, getMyLocationAddress } from '@/lib/offers/queries';
import { createOfferAction } from '../actions';

export const metadata: Metadata = { title: 'Neues Angebot' };

async function NewOfferForm() {
  const { location } = await requireAccount();

  if (location.status !== 'approved') {
    return (
      <p className="rounded-card bg-accent-subtle px-4 py-3 text-callout text-accent-on-subtle">
        Dein Standort ist noch nicht freigeschaltet. Sobald wir ihn geprüft haben, kannst du hier
        Angebote anlegen.
      </p>
    );
  }

  const [address, minDiscountPercent] = await Promise.all([
    getMyLocationAddress(location.id),
    getMinDiscountPercent(),
  ]);

  return (
    <OfferForm
      mode="create"
      action={createOfferAction}
      locationId={location.id}
      minDiscountPercent={minDiscountPercent}
      initialValues={{ ...address, type: 'einzeltermin' }}
    />
  );
}

export default function NewOfferPage() {
  return (
    <>
      <Link href="/angebote" className="text-subhead text-text-link hover:underline">
        ← Zurück zur Übersicht
      </Link>
      <h1 className="mb-6 mt-2 text-title2 text-text-primary">Neues Angebot</h1>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">Formular wird geladen …</p>}
      >
        <NewOfferForm />
      </Suspense>
    </>
  );
}
