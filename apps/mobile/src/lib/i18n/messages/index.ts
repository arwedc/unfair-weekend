import type { Locale } from '@repo/shared/i18n';

import { commonDe, commonEn } from './common';
import { logicDe, logicEn } from './logic';
import { partsDe, partsEn } from './parts';
import { profileDe, profileEn } from './profile';
import { screensDe, screensEn } from './screens';

const de = {
  common: commonDe,
  logic: logicDe,
  screens: screensDe,
  parts: partsDe,
  profile: profileDe,
};

export type Messages = typeof de;

const en: Messages = {
  common: commonEn,
  logic: logicEn,
  screens: screensEn,
  parts: partsEn,
  profile: profileEn,
};

const MESSAGES: Record<Locale, Messages> = { de, en };

/** Alle Texte der App in der gewünschten Sprache. */
export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
