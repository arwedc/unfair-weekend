import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { TemplateForm } from '@/components/templates/template-form';
import { requireAccount } from '@/lib/auth';
import { getMinDiscountPercent, getMyOffer } from '@/lib/offers/queries';
import { offerToTemplateValues, type TemplateFormValues } from '@/lib/templates/form';
import { createTemplateAction } from '../actions';

export const metadata: Metadata = { title: 'Neue Vorlage' };

interface PageProps {
  /** `angebot`: bestehendes Angebot als Ausgangspunkt („Als Vorlage speichern“). */
  searchParams: Promise<{ angebot?: string }>;
}

async function NewTemplateForm({ searchParams }: PageProps) {
  const [{ location }, { angebot }] = await Promise.all([requireAccount(), searchParams]);

  if (location.status !== 'approved') {
    return (
      <p className="rounded-card bg-accent-subtle px-4 py-3 text-callout text-accent-on-subtle">
        Dein Standort ist noch nicht freigeschaltet. Sobald wir ihn geprüft haben, kannst du hier
        Vorlagen anlegen.
      </p>
    );
  }

  const [offer, minDiscountPercent] = await Promise.all([
    angebot ? getMyOffer(angebot) : null,
    getMinDiscountPercent(),
  ]);
  const initialValues: TemplateFormValues = offer
    ? offerToTemplateValues(offer)
    : { type: 'einzeltermin', duration_unit: 'stunden' };

  return (
    <>
      {offer ? (
        <p className="mb-5 rounded-card bg-accent-subtle px-4 py-3 text-subhead text-accent-on-subtle">
          Vorausgefüllt mit den Angaben aus „{offer.title}“. Gib der Vorlage noch einen Namen.
        </p>
      ) : null}
      <TemplateForm
        mode="create"
        action={createTemplateAction}
        locationId={location.id}
        minDiscountPercent={minDiscountPercent}
        initialValues={initialValues}
      />
    </>
  );
}

export default function NewTemplatePage(props: PageProps) {
  return (
    <>
      <Link href="/vorlagen" className="text-subhead text-text-link hover:underline">
        ← Zurück zu den Vorlagen
      </Link>
      <h1 className="mb-6 mt-2 text-title2 text-text-primary">Neue Vorlage</h1>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">Formular wird geladen …</p>}
      >
        <NewTemplateForm {...props} />
      </Suspense>
    </>
  );
}
