import { useLocalSearchParams } from 'expo-router';

import { VenueScreen } from '@/screens/venue/VenueScreen';

export default function StandortRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VenueScreen key={id} locationId={id} />;
}
