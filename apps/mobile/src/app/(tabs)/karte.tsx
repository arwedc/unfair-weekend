import { Map } from 'lucide-react-native';

import { ComingSoonScreen } from '@/screens/setup/ComingSoonScreen';

export default function KarteTab() {
  return (
    <ComingSoonScreen
      icon={Map}
      title="Die Karte kommt bald 🗺️"
      message="Alle Deals in Münster auf einen Blick. Kommt in Phase 2."
    />
  );
}
