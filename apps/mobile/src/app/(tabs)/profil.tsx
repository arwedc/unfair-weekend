import { UserRound } from 'lucide-react-native';

import { ComingSoonScreen } from '@/screens/setup/ComingSoonScreen';

export default function ProfilTab() {
  return (
    <ComingSoonScreen
      icon={UserRound}
      title="Dein Profil"
      message="Login, Favoriten und Einstellungen kommen in Phase 3."
    />
  );
}
