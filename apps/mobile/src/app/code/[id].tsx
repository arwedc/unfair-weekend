import { useLocalSearchParams } from 'expo-router';

import { CodeDetailScreen } from '@/screens/codes/CodeDetailScreen';

export default function CodeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CodeDetailScreen voucherId={id} />;
}
