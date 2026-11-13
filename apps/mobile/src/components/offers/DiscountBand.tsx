import { formatDiscount } from '@repo/shared';
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
import { colors, fonts, gold, MAX_FONT_SCALE, radius, space } from '@/theme';

/** Ab diesem Rabatt leuchtet das Band beim Erscheinen einmal kurz auf. */
export const MEGA_DISCOUNT_PERCENT = 50;

export interface DiscountBandProps {
  percent: number;
  /** Etwas kleiner für Karussell-Karten. */
  compact?: boolean;
}

/**
 * Rabatt als Preisschild in der unteren rechten Fotoecke: Schwarz mit Gold, bündig
 * am Rand, ohne Schatten. Mega-Rabatte glänzen beim Erscheinen einmal kurz
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

  const shineStyle = useAnimatedStyle(() => ({ opacity: shine.get() * 0.35 }));

  return (
    <View style={[styles.band, compact && styles.bandCompact]} accessible={false}>
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
  band: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    backgroundColor: colors.background.inverse,
    // Nur die Innenecke rund, die Außenecke folgt dem Foto.
    borderTopLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  bandCompact: { paddingHorizontal: space[2], paddingVertical: space[1] },
  text: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, color: gold[400] },
  textCompact: { fontSize: 16, lineHeight: 20 },
  shine: { backgroundColor: gold[200] },
});
