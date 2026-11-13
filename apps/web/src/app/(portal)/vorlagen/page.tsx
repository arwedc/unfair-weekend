import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OFFER_TEMPLATE_LIMITS } from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { buttonClass, Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { formatDuration, type OfferTemplate } from '@/lib/templates/form';
import { listMyTemplates } from '@/lib/templates/queries';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.templates.title };
}

type I18n = Awaited<ReturnType<typeof getT>>;

interface PageProps {
  searchParams: Promise<{ gespeichert?: string; geloescht?: string }>;
}

function TemplateRow({ template, i18n }: { template: OfferTemplate; i18n: I18n }) {
  const { locale, t, labels } = i18n;
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
          <span>{labels.offerCategory[template.category]}</span>
          <span aria-hidden>·</span>
          <span>{labels.offerType[template.type]}</span>
          <span aria-hidden>·</span>
          <span>{formatDuration(template.duration_minutes, locale)}</span>
        </div>
        <h2 className="mt-1 truncate text-headline text-text-primary">{template.name}</h2>
        <p className="mt-0.5 truncate text-subhead text-text-secondary">
          {template.title} · {formatPrice(template.deal_price_cents, { locale })}{' '}
          <span className="text-text-tertiary line-through">
            {formatPrice(template.original_price_cents, { locale })}
          </span>{' '}
          (
          {formatDiscount(
            discountPercent(template.original_price_cents, template.deal_price_cents),
            locale,
          )}
          ) · {t.templates.seats(template.capacity)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/vorlagen/${template.id}`}
          className={buttonClass('ghost', 'border border-border-default px-4')}
          aria-label={t.templates.editAria(template.name)}
        >
          {t.templates.edit}
        </Link>
        <Link
          href={`/angebote/neu?vorlage=${template.id}`}
          className={buttonClass('primary', 'px-4')}
          aria-label={t.templates.createOfferAria(template.name)}
        >
          {t.templates.createOffer}
        </Link>
      </div>
    </Card>
  );
}

async function TemplateList({ searchParams }: PageProps) {
  const [, { gespeichert, geloescht }, i18n] = await Promise.all([
    requireAccount(),
    searchParams,
    getT(),
  ]);
  const { t } = i18n;
  const templates = await listMyTemplates();

  const notice = gespeichert ? t.templates.saved : geloescht ? t.templates.deleted : null;

  return (
    <>
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-card bg-status-success-subtle px-4 py-3 text-callout text-status-success-on-subtle"
        >
          {notice}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-headline text-text-primary">{t.templates.emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-md text-callout text-text-secondary">
            {t.templates.emptyText}
          </p>
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {templates.map((template) => (
              <li key={template.id}>
                <TemplateRow template={template} i18n={i18n} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-footnote text-text-tertiary">
            {t.templates.count(templates.length, OFFER_TEMPLATE_LIMITS.maxPerLocation)}
          </p>
        </>
      )}
    </>
  );
}

export default async function TemplatesPage(props: PageProps) {
  const { t } = await getT();
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-title2 text-text-primary">{t.templates.title}</h1>
          <p className="mt-1 text-subhead text-text-secondary">{t.templates.intro}</p>
        </div>
        <Link href="/vorlagen/neu" className={buttonClass('primary', 'shrink-0')}>
          {t.templates.newTemplate}
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">{t.templates.listLoading}</p>}
      >
        <TemplateList {...props} />
      </Suspense>
    </>
  );
}
