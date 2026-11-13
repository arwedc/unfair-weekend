import { formatDiscount } from '@repo/shared';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, fonts, MAX_FONT_SCALE, radii, space } from '@/theme';

export interface DiscountTagProps {
  percent: number;
}

/**
 * Ruhiges Rabatt-Etikett für neben dem Preis: zarte Akzentfläche, kräftige Schrift,
 * ohne Schatten. Für Fotos gibt es weiterhin das auffällige Deal-Badge.
 */
export function DiscountTag({ percent }: DiscountTagProps) {
  return (
    <View style={styles.tag} accessible accessibilityLabel={`${percent} Prozent günstiger`}>
      <Text
        variant="caption"
        style={styles.label}
        maxFontSizeMultiplier={Math.min(MAX_FONT_SCALE, 1.3)}
      >
        {formatDiscount(percent)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'center',
    paddingHorizontal: space[2],
    paddingVertical: space[0.5],
    borderRadius: radii.full,
    backgroundColor: colors.accent.subtle,
  },
  label: { color: colors.accent.onSubtle, fontFamily: fonts.extrabold, letterSpacing: 0.2 },
});
