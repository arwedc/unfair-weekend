import type { Locale } from '@repo/shared/i18n';
import { commonDe, commonEn } from './sections/common';
import { offersDe, offersEn } from './sections/offers';
import { templatesDe, templatesEn } from './sections/templates';
import { reviewsDe, reviewsEn } from './sections/reviews';
import { profileDe, profileEn } from './sections/profile';
import { paymentsDe, paymentsEn } from './sections/payments';
import { checkinDe, checkinEn } from './sections/checkin';
import { adminDe, adminEn } from './sections/admin';
import { onboardingDe, onboardingEn } from './sections/onboarding';

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
  checkin: checkinDe,
  admin: adminDe,
  onboarding: onboardingDe,
};

export type Messages = typeof de;

const en: Messages = {
  common: commonEn,
  offers: offersEn,
  templates: templatesEn,
  reviews: reviewsEn,
  profile: profileEn,
  payments: paymentsEn,
  checkin: checkinEn,
  admin: adminEn,
  onboarding: onboardingEn,
};

const MESSAGES: Record<Locale, Messages> = { de, en };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
