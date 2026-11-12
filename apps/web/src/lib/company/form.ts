import type { Tables } from '@repo/shared';

export type Company = Pick<Tables<'companies'>, 'id' | 'name' | 'description' | 'logo_path'>;

/** Felder des Profilformulars, wie die Parameter von `update_my_company` (ohne `p_`). */
export const COMPANY_FORM_FIELDS = ['name', 'description', 'logo_path'] as const;
export type CompanyFormField = (typeof COMPANY_FORM_FIELDS)[number];
export type CompanyFormValues = Partial<Record<CompanyFormField, string>>;

export interface CompanyFormState {
  errors: Partial<Record<CompanyFormField, string>>;
  formError?: string;
  /** Eingaben zum Wiederbefüllen nach einem Fehler bzw. gespeicherte Werte. */
  values?: CompanyFormValues;
  saved?: boolean;
}

export function companyToFormValues(company: Company): CompanyFormValues {
  return {
    name: company.name,
    description: company.description ?? '',
    logo_path: company.logo_path ?? '',
  };
}
