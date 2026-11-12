import { Ticket } from 'lucide-react-native';

import { ComingSoonScreen } from '@/screens/setup/ComingSoonScreen';

export default function CodesTab() {
  return (
    <ComingSoonScreen
      icon={Ticket}
      title="Noch keine Codes"
      message="Hier landen deine Gutscheincodes. Kommt in Phase 3."
    />
  );
}
