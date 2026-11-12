import { useLocalSearchParams } from 'expo-router';

import { LocationScreen } from '@/screens/location/LocationScreen';

export default function StandortRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LocationScreen locationId={id} />;
}
