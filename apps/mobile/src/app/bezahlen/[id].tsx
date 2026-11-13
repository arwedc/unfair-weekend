import { useLocalSearchParams } from 'expo-router';

import { CheckoutScreen } from '@/screens/checkout/CheckoutScreen';

/** /bezahlen/<Angebots-ID>?plaetze=2 */
export default function CheckoutRoute() {
  const { id, plaetze } = useLocalSearchParams<{ id: string; plaetze?: string }>();
  const seats = Math.max(1, Number.parseInt(plaetze ?? '1', 10) || 1);
  return <CheckoutScreen offerId={id} seats={seats} />;
}
