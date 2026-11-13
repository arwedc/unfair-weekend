import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OfferForm } from '@/components/offers/offer-form';
import { buttonClass, Card } from '@/components/ui';
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
  searchParams: Promise<{ vorlage?: string; modus?: string }>;
}

async function OfferFormView({
  locationId,
  templateId,
}: {
  locationId: string;
  templateId?: string;
}) {
  const [{ t }, address, minDiscountPercent, template, paymentSettings, stripeAccount] =
    await Promise.all([
      getT(),
      getMyLocationAddress(locationId),
      getMinDiscountPercent(),
      templateId ? getMyTemplate(templateId) : null,
      getPaymentSettings(),
      getLocationStripeAccount(locationId),
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

  if (templateId && !template) {
    return (
      <>
        <Link
          href={templateId ? '/angebote/neu?modus=vorlage' : '/angebote/neu'}
          className="mb-4 inline-block text-subhead text-text-link hover:underline"
        >
          {templateId ? t.offers.backToTemplateSelection : t.offers.backToOfferCreation}
        </Link>
        <p
          role="alert"
          className="mb-5 rounded-card bg-status-error-subtle px-4 py-3 text-subhead text-status-error-on-subtle"
        >
          {t.offers.templateMissing}
        </p>
        {payoutSetupNotice}
        <OfferForm
          mode="create"
          action={createOfferAction}
          locationId={locationId}
          minDiscountPercent={minDiscountPercent}
          initialValues={{ ...address, type: 'einzeltermin' }}
        />
      </>
    );
  }

  return (
    <>
      <Link
        href={templateId ? '/angebote/neu?modus=vorlage' : '/angebote/neu'}
        className="mb-4 inline-block text-subhead text-text-link hover:underline"
      >
        {templateId ? t.offers.backToTemplateSelection : t.offers.backToOfferCreation}
      </Link>
      {payoutSetupNotice}
      <OfferForm
        key={template?.id ?? 'custom'}
        mode="create"
        action={createOfferAction}
        locationId={locationId}
        minDiscountPercent={minDiscountPercent}
        initialValues={{
          ...address,
          ...(template ? templateToOfferValues(template) : { type: 'einzeltermin' as const }),
        }}
        template={
          template ? { name: template.name, durationMinutes: template.duration_minutes } : undefined
        }
      />
    </>
  );
}

async function NewOfferForm({ searchParams }: PageProps) {
  const [{ location }, { vorlage, modus }, { locale, t }] = await Promise.all([
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

  if (vorlage || modus === 'custom') {
    return <OfferFormView locationId={location.id} templateId={vorlage} />;
  }

  if (modus === 'vorlage') {
    const templates = await listMyTemplates();
    return (
      <>
        <Link
          href="/angebote/neu"
          className="mb-4 inline-block text-subhead text-text-link hover:underline"
        >
          {t.offers.backToOfferCreation}
        </Link>
        <h2 className="mb-4 text-headline text-text-primary">{t.offers.chooseTemplate}</h2>
        {templates.length > 0 ? (
          <ul className="space-y-3">
            {templates.map((template) => (
              <li key={template.id}>
                <Link
                  href={`/angebote/neu?vorlage=${template.id}`}
                  className="block rounded-card border border-border-subtle bg-surface-raised p-4 shadow-card transition-colors hover:border-accent-vivid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                >
                  <span className="block text-headline text-text-primary">{template.name}</span>
                  <span className="mt-1 block text-subhead text-text-secondary">
                    {template.title} · {formatDuration(template.duration_minutes, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-6">
            <p className="text-callout text-text-secondary">{t.offers.noTemplates}</p>
            <Link href="/vorlagen/neu" className={buttonClass('secondary', 'mt-4 px-4')}>
              {t.offers.createTemplate}
            </Link>
          </Card>
        )}
      </>
    );
  }

  return (
    <>
      <p className="mb-5 text-callout text-text-secondary">{t.offers.creationIntro}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/angebote/neu?modus=vorlage"
          className="group rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          <Card className="h-full p-5 transition-colors group-hover:border-accent-vivid">
            <h2 className="text-headline text-text-primary">{t.offers.fromTemplate}</h2>
            <p className="mt-2 text-subhead text-text-secondary">
              {t.offers.fromTemplateDescription}
            </p>
          </Card>
        </Link>
        <Link
          href="/angebote/neu?modus=custom"
          className="group rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          <Card className="h-full p-5 transition-colors group-hover:border-accent-vivid">
            <h2 className="text-headline text-text-primary">{t.offers.customOffer}</h2>
            <p className="mt-2 text-subhead text-text-secondary">
              {t.offers.customOfferDescription}
            </p>
          </Card>
        </Link>
      </div>
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
      <h1 className="mb-2 mt-2 text-title2 text-text-primary">{t.offers.newOffer}</h1>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">{t.offers.formLoading}</p>}
      >
        <NewOfferForm {...props} />
      </Suspense>
    </>
  );
}
