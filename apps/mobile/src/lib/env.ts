/**
 * Öffentliche Konfiguration aus apps/mobile/.env (EXPO_PUBLIC_…).
 * Expo ersetzt process.env.EXPO_PUBLIC_* beim Bauen. Deshalb jede Variable direkt ansprechen,
 * nicht über process.env[name].
 */

const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} fehlt. Lege apps/mobile/.env nach der Vorlage .env.example an und starte Expo neu.`,
    );
  }
  return value;
}

/** Schalter: „1“, „true“ oder „ja“ schalten ein, alles andere (auch leer) aus. */
function flag(value: string | undefined): boolean {
  return ['1', 'true', 'ja'].includes((value ?? '').trim().toLowerCase());
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL,
  /**
   * Publishable Key von Stripe (pk_test_… bzw. pk_live_…). Optional: Ohne ihn kann die App
   * nicht bezahlen und zeigt das an, solange das Flag payments_enabled an ist.
   */
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
  /**
   * E-Mail/Passwort ist immer verfügbar. Diese Schalter aktivieren optionale E-Mail-OTP-
   * oder OAuth-Methoden, sobald sie im Supabase-Projekt eingerichtet sind.
   */
  auth: {
    emailOtp: flag(process.env.EXPO_PUBLIC_AUTH_EMAIL_OTP),
    apple: flag(process.env.EXPO_PUBLIC_AUTH_APPLE),
    google: flag(process.env.EXPO_PUBLIC_AUTH_GOOGLE),
  },
} as const;
