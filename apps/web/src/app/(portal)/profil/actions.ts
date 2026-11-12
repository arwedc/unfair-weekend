'use server';

import { revalidatePath } from 'next/cache';
import { companySchema, parseRpcError, STORAGE_BUCKETS } from '@repo/shared';
import { requireAccount } from '@/lib/auth';
import {
  COMPANY_FORM_FIELDS,
  type CompanyFormField,
  type CompanyFormState,
  type CompanyFormValues,
} from '@/lib/company/form';
import { getMyCompany } from '@/lib/company/queries';
import { createClient } from '@/lib/supabase/server';

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
  const { location } = await requireAccount();
  const values = readValues(formData);
  const existing = await getMyCompany(location.company_id);
  if (!existing) return { errors: {}, formError: 'Dein Unternehmen wurde nicht gefunden.', values };

  const parsed = companySchema.safeParse(values);
  if (!parsed.success) {
    const errors: CompanyFormState['errors'] = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '') as CompanyFormField;
      errors[key] ??= issue.message;
    }
    return { errors, values, formError: 'Bitte die markierten Felder prüfen.' };
  }

  // Neues Logo nur aus dem eigenen Ordner. Ein unverändertes (z. B. Seed-URL) bleibt erlaubt.
  const logoPath = parsed.data.logo_path;
  if (logoPath && logoPath !== existing.logo_path && !isOwnLogoPath(logoPath, existing.id)) {
    return { errors: { logo_path: 'Bitte das Logo erneut hochladen.' }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_my_company', {
    p_name: parsed.data.name,
    ...(parsed.data.description ? { p_description: parsed.data.description } : {}),
    ...(logoPath ? { p_logo_path: logoPath } : {}),
  });
  if (error || !data) {
    const rpc = parseRpcError(error);
    return { errors: {}, values, formError: rpc?.message ?? 'Speichern hat nicht geklappt.' };
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
