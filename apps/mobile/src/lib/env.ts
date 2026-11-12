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

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL,
} as const;
