'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { endSession, requireSession, startSession } from '@/lib/auth';
import { createOffer, findLocationByCredentials } from '@/lib/mock/data';
import { createOfferSchema, type CreateOfferField } from '@/lib/offers/schema';

export interface LoginState {
  error?: string;
  email?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const location = await findLocationByCredentials(email, password);
  if (!location) {
    return { error: 'E-Mail oder Passwort stimmt nicht.', email };
  }
  await startSession(location.id);
  redirect('/angebote');
}

export async function logout(): Promise<void> {
  await endSession();
  redirect('/login');
}

const OFFER_FIELDS = [
  'title',
  'description',
  'category',
  'type',
  'startsAt',
  'endsAt',
  'originalPriceCents',
  'dealPriceCents',
  'capacity',
  'maxPerUser',
  'address',
] as const satisfies readonly CreateOfferField[];

export interface OfferFormState {
  /** Pro Feld die erste Fehlermeldung. */
  errors: Partial<Record<CreateOfferField, string>>;
  /** Eingaben zurück ans Formular, damit nach einem Fehler nichts verloren geht. */
  values: Partial<Record<CreateOfferField, string>>;
  formError?: string;
}

export async function createOfferAction(
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  const location = await requireSession();

  const values: OfferFormState['values'] = {};
  for (const field of OFFER_FIELDS) {
    values[field] = String(formData.get(field) ?? '');
  }

  const parsed = createOfferSchema.safeParse(values);
  if (!parsed.success) {
    const errors: OfferFormState['errors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as CreateOfferField | undefined;
      if (field && !errors[field]) errors[field] = issue.message;
    }
    return { errors, values, formError: 'Bitte prüfe die markierten Felder.' };
  }

  try {
    await createOffer(location, parsed.data);
  } catch {
    return {
      errors: {},
      values,
      formError: 'Speichern hat nicht geklappt. Bitte nochmal versuchen.',
    };
  }

  revalidatePath('/angebote');
  redirect('/angebote?neu=1');
}
