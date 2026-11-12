import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CompanyForm } from '@/components/company/company-form';
import { requireAccount } from '@/lib/auth';
import { companyToFormValues } from '@/lib/company/form';
import { getMyCompany } from '@/lib/company/queries';
import { updateCompanyAction } from './actions';

export const metadata: Metadata = { title: 'Unternehmensprofil' };

async function CompanyProfile() {
  const { location } = await requireAccount();
  const company = await getMyCompany(location.company_id);
  if (!company) notFound();

  return (
    <CompanyForm
      action={updateCompanyAction}
      companyId={company.id}
      initialValues={companyToFormValues(company)}
    />
  );
}

export default function ProfilePage() {
  return (
    <>
      <h1 className="text-title2 text-text-primary">Unternehmensprofil</h1>
      <p className="mb-6 mt-1 text-subhead text-text-secondary">
        Name, Logo und Beschreibung gelten für alle Standorte deines Unternehmens.
      </p>
      <Suspense fallback={<p className="text-callout text-text-tertiary">Profil wird geladen …</p>}>
        <CompanyProfile />
      </Suspense>
    </>
  );
}
