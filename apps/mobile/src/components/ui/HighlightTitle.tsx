import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii, soft, space, type TextStyleName } from '@/theme';

import { Text } from './Text';

export interface HighlightTitleProps {
  children: ReactNode;
  variant?: TextStyleName;
}

/**
 * Überschrift mit weichem Marker-Strich dahinter (zartes Apricot, leicht versetzt).
 * Der Strich liegt hinter der unteren Texthälfte und ragt etwas über die Ränder.
 */
export function HighlightTitle({ children, variant = 'title3' }: HighlightTitleProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.marker} />
      <Text variant={variant} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', flexShrink: 1 },
  marker: {
    position: 'absolute',
    left: -space[1],
    right: -space[1.5],
    bottom: space[0.5],
    height: '42%',
    borderRadius: radii.xs,
    backgroundColor: soft.tint,
    transform: [{ rotate: '-1deg' }],
  },
});
