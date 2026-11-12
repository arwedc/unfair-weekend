import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow } from '@/theme';

import { PressableScale } from './PressableScale';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** „flat“ ohne Schatten, z. B. für Karten auf grauem Grund. */
  elevation?: 'raised' | 'flat';
  style?: StyleProp<ViewStyle>;
}

/** Weiße Fläche mit runden Ecken. Mit onPress wird sie antippbar (inkl. Eindrück-Animation). */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  elevation = 'raised',
  style,
}: CardProps) {
  const cardStyle = [styles.card, elevation === 'raised' && styles.raised, style];

  if (!onPress) return <View style={cardStyle}>{children}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      pressedScale={0.98}
      style={cardStyle}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.default,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  raised: { boxShadow: shadow.card },
});
