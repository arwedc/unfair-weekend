import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui';
import { colors } from '@/theme';

export interface ComingSoonScreenProps {
  icon: LucideIcon;
  title: string;
  message: string;
}

/** Platzhalter für Tabs, die in einer späteren Phase gebaut werden. */
export function ComingSoonScreen({ icon, title, message }: ComingSoonScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <EmptyState icon={icon} title={title} message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.background.default },
});
