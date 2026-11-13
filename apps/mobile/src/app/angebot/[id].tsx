import { useLocalSearchParams } from 'expo-router';

import { OfferDetailScreen } from '@/screens/offer/OfferDetailScreen';

export default function AngebotRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OfferDetailScreen offerId={id} />;
}
