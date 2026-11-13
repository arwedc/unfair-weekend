'use server';

import { revalidatePath } from 'next/cache';
import { companySchema, parseRpcError, STORAGE_BUCKETS } from '@repo/shared';
import { translateValidationMessage } from '@repo/shared/i18n';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import {
  COMPANY_FORM_FIELDS,
  type CompanyFormField,
  type CompanyFormState,
  type CompanyFormValues,
} from '@/lib/company/form';
import { getMyCompany } from '@/lib/company/queries';
import { createClient } from '@/lib/supabase/server';

export interface LocationImagesState {
  paths: string[];
  saved?: boolean;
  error?: string;
}

export async function updateLocationImagesAction(
  _prev: LocationImagesState,
  formData: FormData,
): Promise<LocationImagesState> {
  const [{ location }, { locale, t }] = await Promise.all([requireAccount(), getT()]);
  const paths = formData
    .getAll('image_paths')
    .map((path) => String(path).trim())
    .filter(Boolean);

  if (
    paths.length > 5 ||
    new Set(paths).size !== paths.length ||
    paths.some((path) => !path.startsWith(`${location.id}/`) || path.includes('..'))
  ) {
    return { paths, error: t.profile.locationImages.saveFailed };
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from('locations')
    .select('image_paths')
    .eq('id', location.id)
    .single();
  if (readError) return { paths, error: t.profile.locationImages.saveFailed };

  const { data, error } = await supabase.rpc('update_my_location_images', {
    p_image_paths: paths,
  });
  if (error || !data) {
    const rpc = parseRpcError(error, locale);
    return { paths, error: rpc?.message ?? t.profile.locationImages.saveFailed };
  }

  const removedPaths = existing.image_paths.filter(
    (path) => !data.includes(path) && path.startsWith(`${location.id}/`),
  );
  if (removedPaths.length > 0) {
    await supabase.storage.from(STORAGE_BUCKETS.offerImages).remove(removedPaths);
  }

  revalidatePath('/profil');
  revalidatePath('/angebote');
  return { paths: data, saved: true };
}

function readValues(formData: FormData): CompanyFormValues {
  const values: CompanyFormValues = {};
  for (const field of COMPANY_FORM_FIELDS) values[field] = String(formData.get(field) ?? '').trim();
  return values;
}

/** Liegt der Pfad im Ordner des eigenen Unternehmens (`<company_id>/<datei>`)? */
function isOwnLogoPath(path: string, companyId: string): boolean {
  return path.startsWith(`${companyId}/`) && !path.includes('..');
}

export async function updateCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const [{ location }, { locale, t }] = await Promise.all([requireAccount(), getT()]);
  const values = readValues(formData);
  const existing = await getMyCompany(location.company_id);
  if (!existing) return { errors: {}, formError: t.profile.notFound, values };

  const parsed = companySchema.safeParse(values);
  if (!parsed.success) {
    const errors: CompanyFormState['errors'] = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '') as CompanyFormField;
      errors[key] ??= translateValidationMessage(issue.message, locale);
    }
    return { errors, values, formError: t.common.checkFields };
  }

  // Neues Logo nur aus dem eigenen Ordner. Ein unverändertes (z. B. Seed-URL) bleibt erlaubt.
  const logoPath = parsed.data.logo_path;
  if (logoPath && logoPath !== existing.logo_path && !isOwnLogoPath(logoPath, existing.id)) {
    return { errors: { logo_path: t.profile.logo.reupload }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_my_company', {
    p_name: parsed.data.name,
    ...(parsed.data.description ? { p_description: parsed.data.description } : {}),
    ...(logoPath ? { p_logo_path: logoPath } : {}),
  });
  if (error || !data) {
    const rpc = parseRpcError(error, locale);
    return { errors: {}, values, formError: rpc?.message ?? t.common.saveFailed };
  }

  // Altes Logo aufräumen, wenn es ersetzt oder entfernt wurde. Klappt das nicht, ist es unkritisch.
  const oldLogo = existing.logo_path;
  if (oldLogo && oldLogo !== data.logo_path && isOwnLogoPath(oldLogo, existing.id)) {
    await supabase.storage.from(STORAGE_BUCKETS.companyLogos).remove([oldLogo]);
  }

  revalidatePath('/profil');
  return {
    errors: {},
    saved: true,
    values: {
      name: data.name,
      description: data.description ?? '',
      logo_path: data.logo_path ?? '',
    },
  };
}
