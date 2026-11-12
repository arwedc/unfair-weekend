import { BottomSheetModal, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import type { ReactNode, Ref } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, space } from '@/theme';

import { Text } from './Text';

/** Steuerung von außen: sheetRef.current?.present() / dismiss(). */
export type SheetRef = BottomSheetModal;

export interface SheetProps {
  ref?: Ref<SheetRef>;
  children: ReactNode;
  title?: string;
  onDismiss?: () => void;
}

/**
 * Bottom Sheet statt Modal (Designvorgabe).
 *
 * Nutzt den Expo-Ersatz für @gorhom/bottom-sheet (gleiche API, aber echte native Sheets
 * und lauffähig in Expo Go). Die Höhe passt sich dem Inhalt an; Hintergrund und
 * Abdunklung kommen vom System.
 */
export function Sheet({ ref, children, title, onDismiss }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onDismiss}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + space[4] }]}>
        {title ? (
          <Text variant="title3" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.surface.raised },
  content: { paddingHorizontal: layout.screenPaddingX, paddingTop: space[6], gap: space[4] },
});
