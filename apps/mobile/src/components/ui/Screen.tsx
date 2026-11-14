import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, space } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Pull-to-Refresh, z. B. <RefreshControl …/> */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Abstand zum Rand weglassen, z. B. für randlose Karussells. */
  edgeToEdge?: boolean;
}

/**
 * Scrollbarer Tab-Screen mit sicherem Abstand oben und einheitlichem Seitenrand.
 *
 * iOS: Die native Tab-Leiste liegt über dem Inhalt. Mit `contentInsetAdjustmentBehavior`
 * „automatic“ rechnet iOS Statusleiste oben und Tab-Leiste unten selbst ein, sodass man
 * bis zum letzten Eintrag scrollen kann. Den oberen Abstand deshalb nicht noch einmal setzen.
 * Android: Die Tab-Leiste liegt unter dem Inhalt, oben braucht es den Abstand von Hand.
 */
export function Screen({ children, refreshControl, edgeToEdge = false }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + space[4] },
        !edgeToEdge && { paddingHorizontal: layout.screenPaddingX },
      ]}
      contentInsetAdjustmentBehavior="automatic"
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
