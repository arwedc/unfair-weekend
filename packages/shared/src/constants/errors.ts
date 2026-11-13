import { DEFAULT_LOCALE, type Locale } from '../i18n/locale';

/**
 * Fehlercodes der RPCs. Die Datenbank wirft sie mit
 * `raise exception using errcode = 'P0001', message = '<CODE>', detail = '<Text>'`.
 * In supabase-js kommt das als `error.code === 'P0001'`, `error.message === '<CODE>'`
 * und `error.details === '<Text>'` an.
 *
 * Neue Codes immer gleichzeitig hier und in der Migration ergänzen.
 * Ein Test in tooling/db prüft, dass beide Listen übereinstimmen.
 */
export const RPC_ERROR_MESSAGES = {
  // Konto
  NICHT_ANGEMELDET: 'Bitte melde dich an.',
  KEIN_ZUGRIFF: 'Dafür fehlt dir die Berechtigung.',
  KEIN_PROFIL: 'Zu diesem Konto gibt es kein Profil.',
  NUR_NUTZER: 'Codes können nur mit einem Nutzerkonto geholt werden.',
  PROFIL_UNVOLLSTAENDIG: 'Bitte gib zuerst deinen Vor- und Nachnamen an.',
  GESPERRT: 'Dein Konto ist wegen verpasster Termine vorübergehend gesperrt.',
  KONTO_NICHT_LOESCHBAR: 'Dieses Konto kann nur vom Admin gelöscht werden.',

  // Angebote
  ANGEBOT_NICHT_GEFUNDEN: 'Dieses Angebot gibt es nicht.',
  ANGEBOT_NICHT_AKTIV: 'Dieses Angebot ist nicht mehr verfügbar.',
  ANGEBOT_BEGONNEN: 'Der Termin hat schon begonnen.',
  ANGEBOT_ABGELAUFEN: 'Der Zeitraum ist abgelaufen.',
  AUSGEBUCHT: 'Leider sind nicht mehr genug Plätze frei.',
  ZU_VIELE_PLAETZE: 'So viele Plätze kannst du für dieses Angebot nicht holen.',
  UNGUELTIGE_PLATZANZAHL: 'Bitte wähle mindestens einen Platz.',
  BEREITS_AKTIVER_CODE: 'Du hast für dieses Angebot schon einen Code.',
  RABATT_ZU_GERING: 'Der Rabatt ist zu gering.',
  PREIS_UNGUELTIG: 'Der Deal-Preis muss unter dem Originalpreis liegen.',
  ZEIT_UNGUELTIG: 'Bitte prüfe Beginn und Ende.',
  ZEIT_IN_VERGANGENHEIT: 'Der Zeitpunkt liegt in der Vergangenheit.',
  BILDER_UNGUELTIG: 'Bitte höchstens 5 Bilder hinzufügen.',
  ADRESSE_UNGUELTIG: 'Bitte gib eine Adresse mit Koordinaten an.',
  KONTINGENT_ZU_KLEIN: 'Das Kontingent kann nicht unter die vergebenen Plätze sinken.',
  FELD_GESPERRT: 'Es gibt schon Codes. Zeit, Adresse und Preise sind deshalb gesperrt.',

  // Angebotsvorlagen
  VORLAGE_NICHT_GEFUNDEN: 'Diese Vorlage gibt es nicht.',
  VORLAGENNAME_VERGEBEN: 'Eine Vorlage mit diesem Namen gibt es schon.',
  VORLAGEN_LIMIT: 'Es sind höchstens 30 Vorlagen möglich.',

  // Codes
  CODE_NICHT_GEFUNDEN: 'Diesen Code gibt es nicht.',
  CODE_NICHT_AKTIV: 'Dieser Code ist nicht mehr gültig.',
  BEREITS_EINGELOEST: 'Dieser Code wurde bereits eingelöst.',
  FALSCHER_STANDORT: 'Dieser Code gehört zu einem anderen Standort.',
  EINLOESUNG_ZU_FRUEH: 'Der Code kann noch nicht eingelöst werden.',
  EINLOESUNG_ZU_SPAET: 'Das Angebot ist bereits vorbei.',
  FRIST_ABGELAUFEN: 'Die Storno-Frist ist abgelaufen.',
  NO_SHOW_NUR_EINZELTERMIN: 'No-Shows gibt es nur bei Einzelterminen.',
  NO_SHOW_ZU_FRUEH: 'No-Show erst ab Beginn des Termins.',
  NO_SHOW_ZU_SPAET: 'No-Show ist nur bis 48 Std. nach Ende möglich.',

  // Bewertungen
  BEWERTUNG_NICHT_MOEGLICH: 'Bewerten kannst du, sobald dein Code vor Ort eingelöst wurde.',
  BEREITS_BEWERTET: 'Diesen Ort hast du schon bewertet.',
  BEWERTUNG_NICHT_GEFUNDEN: 'Diese Bewertung gibt es nicht.',

  // Zahlungen (Variante B, docs/SPEC-PAYMENTS.md)
  ZAHLUNGEN_AUS: 'Buchen mit Bezahlung ist gerade nicht möglich.',
  ZAHLUNG_ERFORDERLICH: 'Dieses Angebot kannst du nur noch mit Bezahlung in der App buchen.',
  ANBIETER_NICHT_BEREIT: 'Dieser Anbieter kann gerade keine Buchungen mit Bezahlung annehmen.',
  AUSZAHLUNGEN_EINRICHTEN:
    'Bitte richte zuerst die Auszahlungen ein. Danach kannst du Angebote veröffentlichen.',
  BETRAG_ZU_GERING: 'Buchungen mit Bezahlung gehen ab 0,50 €.',
  BUCHUNG_NICHT_GEFUNDEN: 'Diese Buchung gibt es nicht.',
  BUCHUNG_NICHT_AKTIV: 'Diese Buchung lässt sich nicht mehr stornieren.',
  RESERVIERUNG_ABGELAUFEN: 'Deine Reservierung ist abgelaufen. Bitte starte die Buchung neu.',
  NO_SHOW_BEZAHLT: 'Bezahlte Buchungen werden ohne Sperre als nicht erschienen markiert.',

  // Standorte und Admin
  KEIN_STANDORTKONTO: 'Dieses Konto gehört zu keinem Standort.',
  STANDORT_NICHT_FREIGESCHALTET: 'Der Standort ist noch nicht freigeschaltet.',
  STANDORT_EXISTIERT_BEREITS: 'Zu diesem Konto gibt es schon einen Standort.',
  STANDORT_NICHT_GEFUNDEN: 'Diesen Standort gibt es nicht.',
  UNTERNEHMEN_NICHT_GEFUNDEN: 'Dieses Unternehmen gibt es nicht.',
  STATUS_UNGUELTIG: 'Diese Statusänderung ist nicht möglich.',

  // Allgemein
  UNGUELTIGE_EINGABE: 'Bitte prüfe deine Eingaben.',
} as const;

export type RpcErrorCode = keyof typeof RPC_ERROR_MESSAGES;

/** Englische Texte zu allen RPC-Codes (gleiche Schlüssel, der Typ erzwingt Vollständigkeit). */
export const RPC_ERROR_MESSAGES_EN = {
  // Account
  NICHT_ANGEMELDET: 'Please sign in.',
  KEIN_ZUGRIFF: "You don't have permission to do that.",
  KEIN_PROFIL: 'There is no profile for this account.',
  NUR_NUTZER: 'Codes can only be claimed with a user account.',
  PROFIL_UNVOLLSTAENDIG: 'Please enter your first and last name first.',
  GESPERRT: 'Your account is temporarily blocked because of missed appointments.',
  KONTO_NICHT_LOESCHBAR: 'This account can only be deleted by an admin.',

  // Offers
  ANGEBOT_NICHT_GEFUNDEN: "This offer doesn't exist.",
  ANGEBOT_NICHT_AKTIV: 'This offer is no longer available.',
  ANGEBOT_BEGONNEN: 'The event has already started.',
  ANGEBOT_ABGELAUFEN: 'The period has ended.',
  AUSGEBUCHT: 'Sorry, there are not enough spots left.',
  ZU_VIELE_PLAETZE: "You can't claim that many spots for this offer.",
  UNGUELTIGE_PLATZANZAHL: 'Please choose at least one spot.',
  BEREITS_AKTIVER_CODE: 'You already have a code for this offer.',
  RABATT_ZU_GERING: 'The discount is too small.',
  PREIS_UNGUELTIG: 'The deal price must be lower than the original price.',
  ZEIT_UNGUELTIG: 'Please check the start and end.',
  ZEIT_IN_VERGANGENHEIT: 'This time is in the past.',
  BILDER_UNGUELTIG: 'Please add at most 5 images.',
  ADRESSE_UNGUELTIG: 'Please enter an address with coordinates.',
  KONTINGENT_ZU_KLEIN: 'The number of spots cannot drop below the spots already taken.',
  FELD_GESPERRT: 'Codes have already been claimed, so time, address and prices are locked.',

  // Offer templates
  VORLAGE_NICHT_GEFUNDEN: "This template doesn't exist.",
  VORLAGENNAME_VERGEBEN: 'A template with this name already exists.',
  VORLAGEN_LIMIT: 'You can have at most 30 templates.',

  // Codes
  CODE_NICHT_GEFUNDEN: "This code doesn't exist.",
  CODE_NICHT_AKTIV: 'This code is no longer valid.',
  BEREITS_EINGELOEST: 'This code has already been redeemed.',
  FALSCHER_STANDORT: 'This code belongs to a different venue.',
  EINLOESUNG_ZU_FRUEH: "This code can't be redeemed yet.",
  EINLOESUNG_ZU_SPAET: 'The offer is already over.',
  FRIST_ABGELAUFEN: 'The cancellation deadline has passed.',
  NO_SHOW_NUR_EINZELTERMIN: 'No-shows only exist for single dates.',
  NO_SHOW_ZU_FRUEH: 'No-shows can only be marked once the event has started.',
  NO_SHOW_ZU_SPAET: 'No-shows can only be marked up to 48 hours after the end.',

  // Reviews
  BEWERTUNG_NICHT_MOEGLICH: 'You can leave a review once your code has been redeemed on site.',
  BEREITS_BEWERTET: "You've already reviewed this place.",
  BEWERTUNG_NICHT_GEFUNDEN: "This review doesn't exist.",

  // Payments
  ZAHLUNGEN_AUS: 'Paid bookings are not available right now.',
  ZAHLUNG_ERFORDERLICH: 'This offer can only be booked with payment in the app.',
  ANBIETER_NICHT_BEREIT: "This venue can't accept paid bookings right now.",
  AUSZAHLUNGEN_EINRICHTEN: 'Please set up payouts first. Then you can publish offers.',
  BETRAG_ZU_GERING: 'Paid bookings start at €0.50.',
  BUCHUNG_NICHT_GEFUNDEN: "This booking doesn't exist.",
  BUCHUNG_NICHT_AKTIV: 'This booking can no longer be cancelled.',
  RESERVIERUNG_ABGELAUFEN: 'Your reservation has expired. Please start the booking again.',
  NO_SHOW_BEZAHLT: 'Paid bookings are marked as no-show without a block.',

  // Venues and admin
  KEIN_STANDORTKONTO: 'This account does not belong to a venue.',
  STANDORT_NICHT_FREIGESCHALTET: 'The venue has not been approved yet.',
  STANDORT_EXISTIERT_BEREITS: 'There is already a venue for this account.',
  STANDORT_NICHT_GEFUNDEN: "This venue doesn't exist.",
  UNTERNEHMEN_NICHT_GEFUNDEN: "This company doesn't exist.",
  STATUS_UNGUELTIG: 'This status change is not possible.',

  // General
  UNGUELTIGE_EINGABE: 'Please check your input.',
} as const satisfies Record<RpcErrorCode, string>;

export const RPC_ERROR_CODES = Object.keys(RPC_ERROR_MESSAGES) as RpcErrorCode[];

/**
 * Zusätzliche Codes der Edge Functions (Antwort: `{ error: { code, message } }`).
 * Die Functions nutzen außerdem KEIN_ZUGRIFF und UNGUELTIGE_EINGABE von oben.
 */
export const FUNCTION_ERROR_MESSAGES = {
  ADRESSE_NICHT_GEFUNDEN: 'Diese Adresse wurde nicht gefunden.',
  GEOCODING_NICHT_VERFUEGBAR: 'Der Kartendienst ist gerade nicht erreichbar.',
  // Zahlungen (stripe-* Functions). Daneben liefern sie die RPC-Codes von oben.
  STRIPE_NICHT_ERREICHBAR: 'Die Zahlung ist gerade nicht möglich. Bitte versuche es gleich erneut.',
  KEIN_STRIPE_KONTO: 'Für diesen Standort sind noch keine Auszahlungen eingerichtet.',
} as const;

export type FunctionErrorCode = keyof typeof FUNCTION_ERROR_MESSAGES;

export const FUNCTION_ERROR_MESSAGES_EN = {
  ADRESSE_NICHT_GEFUNDEN: "We couldn't find this address.",
  GEOCODING_NICHT_VERFUEGBAR: 'The map service is not available right now.',
  STRIPE_NICHT_ERREICHBAR: 'Payment is not possible right now. Please try again shortly.',
  KEIN_STRIPE_KONTO: 'Payouts have not been set up for this venue yet.',
} as const satisfies Record<FunctionErrorCode, string>;

/** Fallback für alles, was kein bekannter Code ist (Netzwerk, unerwartete DB-Fehler). */
export const UNKNOWN_ERROR_MESSAGE = 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';
export const UNKNOWN_ERROR_MESSAGE_EN = 'Something went wrong. Please try again.';

export interface ErrorMessages {
  rpc: Record<RpcErrorCode, string>;
  functions: Record<FunctionErrorCode, string>;
  unknown: string;
}

const ERROR_MESSAGES: Record<Locale, ErrorMessages> = {
  de: {
    rpc: RPC_ERROR_MESSAGES,
    functions: FUNCTION_ERROR_MESSAGES,
    unknown: UNKNOWN_ERROR_MESSAGE,
  },
  en: {
    rpc: RPC_ERROR_MESSAGES_EN,
    functions: FUNCTION_ERROR_MESSAGES_EN,
    unknown: UNKNOWN_ERROR_MESSAGE_EN,
  },
};

/** Alle Fehlertexte (RPC, Edge Functions, Fallback) in der gewünschten Sprache. */
export function getErrorMessages(locale: Locale = DEFAULT_LOCALE): ErrorMessages {
  return ERROR_MESSAGES[locale];
}

export function isRpcErrorCode(value: unknown): value is RpcErrorCode {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(RPC_ERROR_MESSAGES, value)
  );
}

/** Form eines Fehlers aus supabase-js (PostgrestError) oder ähnlich. */
export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export interface ParsedRpcError {
  code: RpcErrorCode | 'UNBEKANNT';
  /**
   * Text zum Anzeigen. Auf Deutsch der genauere Server-Text, falls vorhanden.
   * Auf Englisch immer der Standardtext zum Code (der Server antwortet nur deutsch).
   */
  message: string;
  /** Rohe Server-Meldung, für Logs. */
  raw?: string;
}

/**
 * Übersetzt einen RPC-Fehler in Code + Text in der gewünschten Sprache (Standard: Deutsch).
 * @example
 *   const { error } = await supabase.rpc('claim_voucher', { p_offer_id: id });
 *   const parsed = parseRpcError(error, locale);
 *   if (parsed?.code === 'AUSGEBUCHT') …
 */
export function parseRpcError(
  error: PostgrestLikeError | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): ParsedRpcError | null {
  if (!error) return null;
  const { message, details } = error;
  const messages = getErrorMessages(locale);
  if (isRpcErrorCode(message)) {
    // Der genauere Server-Text ist deutsch. Auf Englisch nehmen wir den Standardtext.
    const specific = locale === 'de' && details && details !== message ? details : undefined;
    return {
      code: message,
      message: specific ?? messages.rpc[message],
      raw: details ?? message,
    };
  }
  return { code: 'UNBEKANNT', message: messages.unknown, raw: message ?? undefined };
}
