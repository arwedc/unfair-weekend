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

export const RPC_ERROR_CODES = Object.keys(RPC_ERROR_MESSAGES) as RpcErrorCode[];

/**
 * Zusätzliche Codes der Edge Functions (Antwort: `{ error: { code, message } }`).
 * Die Functions nutzen außerdem KEIN_ZUGRIFF und UNGUELTIGE_EINGABE von oben.
 */
export const FUNCTION_ERROR_MESSAGES = {
  ADRESSE_NICHT_GEFUNDEN: 'Diese Adresse wurde nicht gefunden.',
  GEOCODING_NICHT_VERFUEGBAR: 'Der Kartendienst ist gerade nicht erreichbar.',
} as const;

export type FunctionErrorCode = keyof typeof FUNCTION_ERROR_MESSAGES;

/** Fallback für alles, was kein bekannter Code ist (Netzwerk, unerwartete DB-Fehler). */
export const UNKNOWN_ERROR_MESSAGE = 'Etwas ist schiefgelaufen. Bitte versuche es erneut.';

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
  /** Deutscher Text zum Anzeigen (der genauere Server-Text, falls vorhanden). */
  message: string;
  /** Rohe Server-Meldung, für Logs. */
  raw?: string;
}

/**
 * Übersetzt einen RPC-Fehler in Code + deutschen Text.
 * @example
 *   const { error } = await supabase.rpc('claim_voucher', { p_offer_id: id });
 *   const parsed = parseRpcError(error);
 *   if (parsed?.code === 'AUSGEBUCHT') …
 */
export function parseRpcError(error: PostgrestLikeError | null | undefined): ParsedRpcError | null {
  if (!error) return null;
  const { message, details } = error;
  if (isRpcErrorCode(message)) {
    const specific = details && details !== message ? details : undefined;
    return {
      code: message,
      message: specific ?? RPC_ERROR_MESSAGES[message],
      raw: details ?? message,
    };
  }
  return { code: 'UNBEKANNT', message: UNKNOWN_ERROR_MESSAGE, raw: message ?? undefined };
}
