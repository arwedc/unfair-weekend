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
import { colors, fonts, gold, MAX_FONT_SCALE } from '@/theme';

/** Ab diesem Rabatt leuchtet das Band beim Erscheinen einmal kurz auf. */
export const MEGA_DISCOUNT_PERCENT = 50;

export interface DiscountBandProps {
  percent: number;
  /** Etwas kleiner für Karussell-Karten. */
  compact?: boolean;
}

/**
 * Rabatt als Klebestreifen: ein schwarzes Band mit goldener Schrift, diagonal über die linke
 * obere Fotoecke geklebt. Die Karte schneidet die Enden ab (overflow: hidden). Mega-Rabatte
 * glänzen beim Erscheinen einmal kurz (bei „Bewegung reduzieren“ nicht).
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
      {/* Feine Linien oben und unten, damit es wie ein Stück Klebeband wirkt. */}
      <View style={[styles.edge, styles.edgeTop]} pointerEvents="none" />
      <View style={[styles.edge, styles.edgeBottom]} pointerEvents="none" />
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

/**
 * Maße des Streifens. Die Mitte liegt auf der Diagonalen der Ecke (Abstand CORNER zu beiden Rändern),
 * dann um 45° gedreht. Sichtbar ist das Stück zwischen den Fotorändern.
 */
const BAND = { width: 150, height: 30, corner: 34 };
const BAND_COMPACT = { width: 130, height: 26, corner: 30 };

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: BAND.corner - BAND.height / 2,
    left: BAND.corner - BAND.width / 2,
    width: BAND.width,
    height: BAND.height,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.inverse,
    transform: [{ rotate: '-45deg' }],
    boxShadow: '0 2px 6px rgba(10, 10, 10, 0.3)',
    overflow: 'hidden',
  },
  bandCompact: {
    top: BAND_COMPACT.corner - BAND_COMPACT.height / 2,
    left: BAND_COMPACT.corner - BAND_COMPACT.width / 2,
    width: BAND_COMPACT.width,
    height: BAND_COMPACT.height,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: gold[700],
  },
  edgeTop: { top: 2 },
  edgeBottom: { bottom: 2 },
  text: { fontFamily: fonts.extrabold, fontSize: 15, lineHeight: 18, color: gold[400] },
  textCompact: { fontSize: 13, lineHeight: 16 },
  shine: { backgroundColor: gold[200] },
});
