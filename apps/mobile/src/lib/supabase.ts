/**
 * Supabase-Client der App. Nutzt nur URL und Publishable Key, nie den Secret Key.
 * Alle Geschäftsregeln laufen serverseitig in RPCs; Fehler über parseRpcError aus @repo/shared übersetzen.
 */
import type { Database } from '@repo/shared/types';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from './env';
import { SecureSessionStorage } from './secure-session-storage';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: new SecureSessionStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Token nur aktualisieren, solange die App im Vordergrund ist (Empfehlung der Supabase-Doku für React Native).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
