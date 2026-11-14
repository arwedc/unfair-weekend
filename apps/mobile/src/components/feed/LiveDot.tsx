import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii } from '@/theme';

const DOT = 10;

/**
 * Pulsierender Punkt in der Markenfarbe, z. B. neben „Last Minute“: zeigt „läuft gerade“,
 * ohne Emoji. Bei „Bewegung reduzieren“ bleibt er ruhig stehen.
 */
export function LiveDot() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(
      withRepeat(withTiming(1, { duration: 1400, reduceMotion: ReduceMotion.System }), -1, false),
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 1.4 }],
  }));

  return (
    <View style={styles.wrap} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.dot, styles.ring, ring]} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.full,
    backgroundColor: colors.accent.solidPressed,
  },
  ring: { position: 'absolute' },
});
