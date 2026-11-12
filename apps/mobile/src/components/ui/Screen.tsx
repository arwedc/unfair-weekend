import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, space } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Pull-to-Refresh, z. B. <RefreshControl …/> */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Abstand zum Rand weglassen, z. B. für randlose Karussells. */
  edgeToEdge?: boolean;
}

/** Scrollbarer Tab-Screen mit sicherem Abstand oben und einheitlichem Seitenrand. */
export function Screen({ children, refreshControl, edgeToEdge = false }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space[4] },
        !edgeToEdge && { paddingHorizontal: layout.screenPaddingX },
      ]}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background.default },
  content: { gap: space[6], paddingBottom: space[12] },
});
