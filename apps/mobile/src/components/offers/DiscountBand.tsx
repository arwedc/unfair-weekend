import { formatDiscount } from '@repo/shared';
import { Zap } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { badge, colors, fonts, gold, MAX_FONT_SCALE, radii, space } from '@/theme';

/** Ab diesem Rabatt bekommt das Etikett einen Blitz und glänzt beim Erscheinen einmal kurz. */
export const MEGA_DISCOUNT_PERCENT = 50;

export interface DiscountBandProps {
  percent: number;
  /** Etwas kleiner für Karussell-Karten. */
  compact?: boolean;
}

/**
 * Rabatt als goldenes Etikett unten links auf dem Foto: eine ruhige Fläche in der Markenfarbe,
 * schwarze Schrift. Mega-Rabatte bekommen einen Blitz und glänzen beim Erscheinen einmal kurz
 * (bei „Bewegung reduzieren“ nicht).
 */
export function DiscountBand({ percent, compact = false }: DiscountBandProps) {
  const { locale } = useT();
  const shine = useSharedValue(0);
  const mega = percent >= MEGA_DISCOUNT_PERCENT;

  useEffect(() => {
    if (!mega) return;
    shine.set(
      withDelay(
        250,
        withSequence(
          withTiming(1, { duration: 280, reduceMotion: ReduceMotion.System }),
          withTiming(0, { duration: 520, reduceMotion: ReduceMotion.System }),
        ),
      ),
    );
  }, [mega, shine]);

  const shineStyle = useAnimatedStyle(() => ({ opacity: shine.get() * 0.6 }));

  return (
    <View style={[styles.label, compact && styles.labelCompact]} accessible={false}>
      {mega ? (
        <Zap
          size={compact ? 13 : 15}
          color={colors.text.primary}
          fill={colors.text.primary}
          strokeWidth={2}
        />
      ) : null}
      <Text
        style={[styles.text, compact && styles.textCompact]}
        maxFontSizeMultiplier={Math.min(MAX_FONT_SCALE, 1.3)}
      >
        {formatDiscount(percent, locale)}
      </Text>
      {mega ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.shine, shineStyle]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    left: badge.inset,
    bottom: badge.inset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: colors.accent.solid,
    boxShadow: badge.shadow,
    overflow: 'hidden',
  },
  labelCompact: { paddingHorizontal: space[2], paddingVertical: space[1] },
  text: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  textCompact: { fontSize: 14, lineHeight: 18 },
  shine: { backgroundColor: gold[100] },
});
