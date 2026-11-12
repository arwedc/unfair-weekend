import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { badge, colors, MAX_FONT_SCALE, toTextStyle } from '@/theme';

import { Text } from './Text';

export type BadgeVariant = keyof typeof colors.badge;

export interface BadgeProps {
  label: string;
  /** deal = Rabatt (Akzent), urgent = Zeitdruck (schwarz), neutral = Info (weiß), soldOut = ausgebucht. */
  variant?: BadgeVariant;
  size?: 'default' | 'large';
  icon?: LucideIcon;
  /** Schatten, damit das Badge auf Fotos lesbar bleibt. */
  onImage?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Deal-Badge, z. B. „−40 %“, „Nur heute“, „Noch 2 Plätze“. Liegt meist direkt auf dem Bild. */
export function Badge({
  label,
  variant = 'deal',
  size = 'default',
  icon: Icon,
  onImage = false,
  style,
}: BadgeProps) {
  const palette = colors.badge[variant];
  const geometry = size === 'large' ? badge.large : badge;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.background,
          paddingHorizontal: geometry.paddingX,
          paddingVertical: geometry.paddingY,
        },
        onImage && styles.onImage,
        style,
      ]}
    >
      {Icon ? (
        <Icon size={geometry.textStyle.fontSize} color={palette.foreground} strokeWidth={2.5} />
      ) : null}
      <Text
        maxFontSizeMultiplier={Math.min(MAX_FONT_SCALE, 1.3)}
        style={[toTextStyle(geometry.textStyle), { color: palette.foreground }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: badge.gap,
    borderRadius: badge.radius,
    borderCurve: 'continuous',
  },
  onImage: { boxShadow: badge.shadow },
});
