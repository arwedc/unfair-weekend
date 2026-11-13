import type { Locale } from '@repo/shared/i18n';
import { commonDe, commonEn } from './sections/common';
import { offersDe, offersEn } from './sections/offers';
import { templatesDe, templatesEn } from './sections/templates';
import { reviewsDe, reviewsEn } from './sections/reviews';
import { profileDe, profileEn } from './sections/profile';
import { paymentsDe, paymentsEn } from './sections/payments';
import { adminDe, adminEn } from './sections/admin';

/**
 * Texte der Website. Deutsch ist die Vorlage, Englisch muss dieselbe Form haben
 * (der Typ `Widen` erzwingt das). Inhalte aus der Datenbank werden nicht übersetzt.
 */
const de = {
  common: commonDe,
  offers: offersDe,
  templates: templatesDe,
  reviews: reviewsDe,
  profile: profileDe,
  payments: paymentsDe,
  admin: adminDe,
};

export type Messages = typeof de;

const en: Messages = {
  common: commonEn,
  offers: offersEn,
  templates: templatesEn,
  reviews: reviewsEn,
  profile: profileEn,
  payments: paymentsEn,
  admin: adminEn,
};

const MESSAGES: Record<Locale, Messages> = { de, en };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
