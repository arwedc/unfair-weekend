/**
 * Gemeinsamer Code der Stripe-Edge-Functions (Zahlungen, Variante B).
 * Regeln und Ablauf: docs/SPEC-PAYMENTS.md, docs/PAYMENTS.md.
 *
 * Secrets (nur als Supabase-Secrets, nie im Repo):
 *   STRIPE_SECRET_KEY               sk_test_… (Sandbox) bzw. später sk_live_…
 *   STRIPE_WEBHOOK_SECRET           whsec_… Endpunkt für Plattform-Events (Snapshot)
 *   STRIPE_CONNECT_WEBHOOK_SECRET   whsec_… Endpunkt für Konto-Events (Accounts v2, Thin Events)
 * Optionale Einstellungen:
 *   STRIPE_PAYMENT_METHOD_TYPES     z. B. "card,klarna" (Standard: "card"; Apple/Google Pay laufen über card)
 *   PAYMENTS_RETURN_ORIGINS         erlaubte Rücksprung-Adressen fürs Onboarding,
 *                                   kommagetrennt (Standard: http://localhost:3000)
 */
import Stripe from 'npm:stripe@23.1.0';

export type { Stripe };

/** Gleiche API-Version wie die Bibliothek (Accounts v2 inklusive). */
export const STRIPE_API_VERSION = '2026-10-28.endive' as const;

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) {
    throw new Error('STRIPE_SECRET_KEY fehlt oder ist ungültig');
  }
  client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    appInfo: { name: 'unfair-weekend' },
  });
  return client;
}

/** Webhooks in Deno nur asynchron prüfen (WebCrypto). */
export const cryptoProvider = Stripe.createSubtleCryptoProvider();

type AllowedMethod = Stripe.PaymentIntentCreateParams.AllowedPaymentMethodType;
const SUPPORTED_METHODS = ['card', 'klarna', 'paypal'] as const satisfies readonly AllowedMethod[];

/** Erlaubte Zahlungsmethoden. Keine verzögerten Methoden (SEPA o. Ä.): Die Reservierung verfällt nach Minuten. */
export function paymentMethodTypes(): AllowedMethod[] {
  const configured = (Deno.env.get('STRIPE_PAYMENT_METHOD_TYPES') ?? 'card')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is (typeof SUPPORTED_METHODS)[number] =>
      (SUPPORTED_METHODS as readonly string[]).includes(value),
    );
  return configured.length > 0 ? configured : ['card'];
}

/** Rücksprung-URL fürs Onboarding nur zu bekannten Adressen (kein offener Redirect). */
export function allowedReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const origins = (Deno.env.get('PAYMENTS_RETURN_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''));
  return origins.includes(url.origin) ? url.toString() : null;
}

/** Antwortformat wie bei geocode: { error: { code, message } } */
export function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Fehler aus einem RPC weiterreichen. Die Codes sind dieselben wie in
 * RPC_ERROR_MESSAGES (@repo/shared), der Text kommt vom Server.
 */
export function rpcFail(error: {
  message: string;
  details?: string | null;
  code?: string;
}): Response {
  if (error.code === 'P0001') {
    return fail(409, error.message, error.details || error.message);
  }
  console.error('RPC-Fehler', error.code, error.message);
  return fail(500, 'UNBEKANNT', 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Stripe-Fehler, bei denen ein neuer Versuch nichts ändert. */
export function isPermanentStripeError(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError)) return false;
  const retryable = new Set([
    'balance_insufficient',
    'insufficient_funds',
    'lock_timeout',
    'rate_limit',
  ]);
  if (error.code && retryable.has(error.code)) return false;
  return (
    error.type === 'StripeInvalidRequestError' ||
    error.type === 'StripeCardError' ||
    error.type === 'StripePermissionError'
  );
}

export function stripeErrorText(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    return `${error.type}${error.code ? `/${error.code}` : ''}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
