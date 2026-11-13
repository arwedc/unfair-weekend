import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DeleteTemplate } from '@/components/templates/delete-template';
import { TemplateForm } from '@/components/templates/template-form';
import { buttonClass } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { getMinDiscountPercent } from '@/lib/offers/queries';
import { templateToFormValues } from '@/lib/templates/form';
import { getMyTemplate } from '@/lib/templates/queries';
import { deleteTemplateAction, updateTemplateAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.templates.editTitle };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

async function TemplateDetail({ params }: PageProps) {
  const [{ location }, { id }, { t }] = await Promise.all([requireAccount(), params, getT()]);
  const [template, minDiscountPercent] = await Promise.all([
    getMyTemplate(id),
    getMinDiscountPercent(),
  ]);
  if (!template) notFound();

  return (
    <>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-subhead text-text-secondary">{t.templates.label}</p>
          <h1 className="text-title2 text-text-primary">{template.name}</h1>
        </div>
        <Link href={`/angebote/neu?vorlage=${template.id}`} className={buttonClass('primary')}>
          {t.templates.createOffer}
        </Link>
      </div>
      <TemplateForm
        mode="edit"
        action={updateTemplateAction.bind(null, template.id)}
        locationId={location.id}
        minDiscountPercent={minDiscountPercent}
        initialValues={templateToFormValues(template)}
      />
      <DeleteTemplate action={deleteTemplateAction.bind(null, template.id)} />
    </>
  );
}

export default async function TemplatePage(props: PageProps) {
  const { t } = await getT();
  return (
    <>
      <Link href="/vorlagen" className="text-subhead text-text-link hover:underline">
        {t.templates.backToTemplates}
      </Link>
      <Suspense
        fallback={
          <p className="mt-4 text-callout text-text-tertiary">{t.templates.detailLoading}</p>
        }
      >
        <TemplateDetail {...props} />
      </Suspense>
    </>
  );
}
