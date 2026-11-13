import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { TemplateForm } from '@/components/templates/template-form';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { getMinDiscountPercent, getMyOffer } from '@/lib/offers/queries';
import { offerToTemplateValues, type TemplateFormValues } from '@/lib/templates/form';
import { createTemplateAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.templates.newTemplate };
}

interface PageProps {
  /** `angebot`: bestehendes Angebot als Ausgangspunkt („Als Vorlage speichern“). */
  searchParams: Promise<{ angebot?: string }>;
}

async function NewTemplateForm({ searchParams }: PageProps) {
  const [{ location }, { angebot }, { t }] = await Promise.all([
    requireAccount(),
    searchParams,
    getT(),
  ]);

  if (location.status !== 'approved') {
    return (
      <p className="rounded-card bg-accent-subtle px-4 py-3 text-callout text-accent-on-subtle">
        {t.templates.notApproved}
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
          {t.templates.prefilledFrom(offer.title)}
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

export default async function NewTemplatePage(props: PageProps) {
  const { t } = await getT();
  return (
    <>
      <Link href="/vorlagen" className="text-subhead text-text-link hover:underline">
        {t.templates.backToTemplates}
      </Link>
      <h1 className="mb-6 mt-2 text-title2 text-text-primary">{t.templates.newTemplate}</h1>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">{t.offers.formLoading}</p>}
      >
        <NewTemplateForm {...props} />
      </Suspense>
    </>
  );
}
