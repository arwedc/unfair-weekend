import { useLocalSearchParams } from 'expo-router';

import { SectionScreen } from '@/screens/section/SectionScreen';

/** Alle Angebote eines Feed-Abschnitts mit Karte (Pfeil neben der Reihe in „Entdecken“). */
export default function AbschnittRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  return <SectionScreen key={key} sectionKey={key} />;
}
