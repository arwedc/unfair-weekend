import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OfferForm } from '@/components/offers/offer-form';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { getMinDiscountPercent, getMyLocationAddress } from '@/lib/offers/queries';
import { formatDuration, templateToOfferValues } from '@/lib/templates/form';
import { getMyTemplate, listMyTemplates } from '@/lib/templates/queries';
import { bookingMode } from '@repo/shared';
import { getLocationStripeAccount, getPaymentSettings } from '@/lib/zahlungen/queries';
import { createOfferAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.offers.newOffer };
}

interface PageProps {
  /** `vorlage`: Angebot aus dieser Vorlage erstellen (alles vorausgefüllt bis auf die Zeit). */
  searchParams: Promise<{ vorlage?: string }>;
}

async function NewOfferForm({ searchParams }: PageProps) {
  const [{ location }, { vorlage }, { locale, t }] = await Promise.all([
    requireAccount(),
    searchParams,
    getT(),
  ]);

  if (location.status !== 'approved') {
    return (
      <p className="rounded-card bg-accent-subtle px-4 py-3 text-callout text-accent-on-subtle">
        {t.offers.notApproved}
      </p>
    );
  }

  const [address, minDiscountPercent, template, templates, paymentSettings, stripeAccount] =
    await Promise.all([
      getMyLocationAddress(location.id),
      getMinDiscountPercent(),
      vorlage ? getMyTemplate(vorlage) : null,
      vorlage ? [] : listMyTemplates(),
      getPaymentSettings(),
      getLocationStripeAccount(location.id),
    ]);

  const needsPayoutSetup =
    bookingMode(paymentSettings) === 'bezahlung' && stripeAccount?.is_ready !== true;
  const payoutSetupNotice = needsPayoutSetup ? (
    <p className="mb-5 rounded-card bg-status-warning-subtle px-4 py-3 text-callout text-status-warning-on-subtle">
      {t.offers.payoutSetupNotice}{' '}
      <Link
        href="/auszahlungen"
        className="font-semibold text-text-link underline underline-offset-2"
      >
        {t.offers.payoutSetupLink}
      </Link>
    </p>
  ) : null;

  if (template) {
    return (
      <>
        {payoutSetupNotice}
        <OfferForm
          // Eigener key: Beim Wechsel der Vorlage beginnt das Formular frisch.
          key={template.id}
          mode="create"
          action={createOfferAction}
          locationId={location.id}
          minDiscountPercent={minDiscountPercent}
          initialValues={{ ...address, ...templateToOfferValues(template) }}
          template={{ name: template.name, durationMinutes: template.duration_minutes }}
        />
      </>
    );
  }

  return (
    <>
      {vorlage ? (
        <p
          role="alert"
          className="mb-5 rounded-card bg-status-error-subtle px-4 py-3 text-subhead text-status-error-on-subtle"
        >
          {t.offers.templateMissing}
        </p>
      ) : null}
      {payoutSetupNotice}
      {templates.length > 0 ? (
        <section aria-labelledby="aus-vorlage" className="mb-6">
          <h2 id="aus-vorlage" className="text-subhead text-text-secondary">
            {t.offers.fasterWithTemplate}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <Link
                  href={`/angebote/neu?vorlage=${tpl.id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border-default bg-surface-default px-4 text-subhead text-text-primary transition-colors duration-150 hover:border-accent-vivid hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                >
                  <span className="font-semibold">{tpl.name}</span>
                  <span className="text-text-tertiary">
                    {formatDuration(tpl.duration_minutes, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <OfferForm
        mode="create"
        action={createOfferAction}
        locationId={location.id}
        minDiscountPercent={minDiscountPercent}
        initialValues={{ ...address, type: 'einzeltermin' }}
      />
    </>
  );
}

export default async function NewOfferPage(props: PageProps) {
  const { t } = await getT();
  return (
    <>
      <Link href="/angebote" className="text-subhead text-text-link hover:underline">
        {t.common.backToOverview}
      </Link>
      <h1 className="mb-6 mt-2 text-title2 text-text-primary">{t.offers.newOffer}</h1>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">{t.offers.formLoading}</p>}
      >
        <NewOfferForm {...props} />
      </Suspense>
    </>
  );
}
