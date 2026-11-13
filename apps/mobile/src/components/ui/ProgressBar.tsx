import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, duration, radii, soft, space } from '@/theme';

export interface ProgressBarProps {
  /** Fortschritt von 0 bis 1. */
  value: number;
  /** Für Screenreader, z. B. „Schritt 2 von 3“. */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fortschrittsbalken, z. B. für Formulare in mehreren Schritten.
 * Füllt sich sanft; bei „Bewegung reduzieren“ springt er sofort auf den neuen Stand.
 */
export function ProgressBar({ value, accessibilityLabel, style }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(clamped);

  useEffect(() => {
    progress.set(reduceMotion ? clamped : withTiming(clamped, { duration: duration.slow }));
  }, [clamped, progress, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, style]}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: space[2],
    borderRadius: radii.full,
    backgroundColor: soft.tint,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.full, backgroundColor: colors.accent.solid },
});
