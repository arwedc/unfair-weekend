import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CompanyForm } from '@/components/company/company-form';
import { LocationImages } from '@/components/company/location-images';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { companyToFormValues } from '@/lib/company/form';
import { getMyCompany, getMyLocationImages } from '@/lib/company/queries';
import { updateCompanyAction, updateLocationImagesAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.profile.title };
}

async function CompanyProfile() {
  const { location } = await requireAccount();
  const [company, imagePaths] = await Promise.all([
    getMyCompany(location.company_id),
    getMyLocationImages(location.id),
  ]);
  if (!company) notFound();

  return (
    <>
      <CompanyForm
        action={updateCompanyAction}
        companyId={company.id}
        initialValues={companyToFormValues(company)}
      />
      <LocationImages
        key={imagePaths.join('|')}
        locationId={location.id}
        initialPaths={imagePaths}
        action={updateLocationImagesAction}
      />
    </>
  );
}

export default async function ProfilePage() {
  const { t } = await getT();
  return (
    <>
      <h1 className="text-title2 text-text-primary">{t.profile.title}</h1>
      <p className="mb-6 mt-1 text-subhead text-text-secondary">{t.profile.intro}</p>
      <Suspense fallback={<p className="text-callout text-text-tertiary">{t.profile.loading}</p>}>
        <CompanyProfile />
      </Suspense>
    </>
  );
}
