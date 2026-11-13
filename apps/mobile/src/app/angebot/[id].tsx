import { useLocalSearchParams } from 'expo-router';

import { VenueScreen } from '@/screens/venue/VenueScreen';

/** Ein Angebot öffnet die Seite seines Standorts, mit diesem Angebot oben ausgewählt. */
export default function AngebotRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VenueScreen key={id} offerId={id} />;
}
