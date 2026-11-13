import { Redirect, useLocalSearchParams } from 'expo-router';

import { isLegalPage, LegalScreen } from '@/screens/profile/LegalScreen';

export default function RechtlichesRoute() {
  const { seite } = useLocalSearchParams<{ seite: string }>();
  if (!isLegalPage(seite)) return <Redirect href="/profil" />;
  return <LegalScreen page={seite} />;
}
