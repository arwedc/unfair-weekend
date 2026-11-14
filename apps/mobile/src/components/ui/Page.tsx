import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type RefreshControlProps } from 'react-native';

import { colors, layout, space } from '@/theme';

export interface PageProps {
  children: ReactNode;
  /** Pull-to-Refresh für Stack-Unterseiten. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

/**
 * Unterseite im Stack (z. B. Einstellungen, Hilfe): scrollt unter dem nativen Kopf mit großem
 * Titel, einheitlicher Seitenrand, Tastatur schiebt den Inhalt mit.
 */
export function Page({ children, refreshControl }: PageProps) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[2],
    paddingBottom: space[12],
    gap: space[6],
  },
});
