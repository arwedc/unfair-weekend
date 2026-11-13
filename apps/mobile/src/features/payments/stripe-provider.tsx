import { StripeProvider } from '@stripe/stripe-react-native';
import Constants, { AppOwnership } from 'expo-constants';
import * as Linking from 'expo-linking';
import type { ReactElement } from 'react';

import { env } from '@/lib/env';

/**
 * Stripe für das PaymentSheet. Ohne Publishable Key bleibt Stripe aus (Variante A läuft
 * normal weiter). Die Rücksprung-URL braucht in Expo Go das „/--/“ (laut Expo-Doku).
 */
export function PaymentsProvider({ children }: { children: ReactElement }) {
  if (!env.stripePublishableKey) return children;
  return (
    <StripeProvider publishableKey={env.stripePublishableKey} urlScheme={stripeReturnUrl()}>
      {children}
    </StripeProvider>
  );
}

export function stripeReturnUrl(): string {
  return Constants.appOwnership === AppOwnership.Expo
    ? Linking.createURL('/--/')
    : Linking.createURL('');
}

export const paymentsAvailable = env.stripePublishableKey !== null;
