import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OFFER_CATEGORY_LABELS, OFFER_TEMPLATE_LIMITS, OFFER_TYPE_LABELS } from '@repo/shared';
import { discountPercent, formatDiscount, formatPrice } from '@repo/shared/utils';
import { buttonClass, Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { formatDuration, type OfferTemplate } from '@/lib/templates/form';
import { listMyTemplates } from '@/lib/templates/queries';

export const metadata: Metadata = { title: 'Vorlagen' };

interface PageProps {
  searchParams: Promise<{ gespeichert?: string; geloescht?: string }>;
}

function TemplateRow({ template }: { template: OfferTemplate }) {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
          <span>{OFFER_CATEGORY_LABELS[template.category]}</span>
          <span aria-hidden>·</span>
          <span>{OFFER_TYPE_LABELS[template.type]}</span>
          <span aria-hidden>·</span>
          <span>{formatDuration(template.duration_minutes)}</span>
        </div>
        <h2 className="mt-1 truncate text-headline text-text-primary">{template.name}</h2>
        <p className="mt-0.5 truncate text-subhead text-text-secondary">
          {template.title} · {formatPrice(template.deal_price_cents)}{' '}
          <span className="text-text-tertiary line-through">
            {formatPrice(template.original_price_cents)}
          </span>{' '}
          (
          {formatDiscount(
            discountPercent(template.original_price_cents, template.deal_price_cents),
          )}
          ) · {template.capacity} Plätze
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/vorlagen/${template.id}`}
          className={buttonClass('ghost', 'border border-border-default px-4')}
          aria-label={`Vorlage „${template.name}“ bearbeiten`}
        >
          Bearbeiten
        </Link>
        <Link
          href={`/angebote/neu?vorlage=${template.id}`}
          className={buttonClass('primary', 'px-4')}
          aria-label={`Angebot aus Vorlage „${template.name}“ erstellen`}
        >
          Angebot erstellen
        </Link>
      </div>
    </Card>
  );
}

async function TemplateList({ searchParams }: PageProps) {
  const [, { gespeichert, geloescht }] = await Promise.all([requireAccount(), searchParams]);
  const templates = await listMyTemplates();

  const notice = gespeichert ? 'Vorlage gespeichert.' : geloescht ? 'Vorlage gelöscht.' : null;

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
          <p className="text-headline text-text-primary">Noch keine Vorlagen</p>
          <p className="mx-auto mt-1 max-w-md text-callout text-text-secondary">
            Leg für Angebote, die du öfter machst, eine Vorlage an. Fällt kurzfristig etwas aus,
            wählst du nur noch den Beginn und das Angebot ist live.
          </p>
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {templates.map((template) => (
              <li key={template.id}>
                <TemplateRow template={template} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-footnote text-text-tertiary">
            {templates.length} von {OFFER_TEMPLATE_LIMITS.maxPerLocation} Vorlagen
          </p>
        </>
      )}
    </>
  );
}

export default function TemplatesPage(props: PageProps) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-title2 text-text-primary">Vorlagen</h1>
          <p className="mt-1 text-subhead text-text-secondary">
            Für Angebote, die du immer wieder machst. Aus einer Vorlage wird in Sekunden ein
            Angebot.
          </p>
        </div>
        <Link href="/vorlagen/neu" className={buttonClass('primary', 'shrink-0')}>
          Neue Vorlage
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-callout text-text-tertiary">Vorlagen werden geladen …</p>}
      >
        <TemplateList {...props} />
      </Suspense>
    </>
  );
}
