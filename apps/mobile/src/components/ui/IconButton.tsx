import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radii, shadow } from '@/theme';

import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: LucideIcon;
  /** Pflicht: Icons allein sagen Screenreadern nichts. */
  accessibilityLabel: string;
  onPress?: () => void;
  /** „floating“ = weißer Kreis mit Schatten, z. B. über Fotos oder der Karte. */
  variant?: 'floating' | 'plain';
  /** Aktiv, z. B. Herz gefüllt. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Runder Icon-Knopf in Mindestgröße für Touch-Flächen. */
export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  variant = 'floating',
  active = false,
  style,
}: IconButtonProps) {
  const color = active ? colors.accent.solid : colors.text.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={6}
      pressedScale={0.92}
      style={[styles.base, variant === 'floating' && styles.floating, style]}
    >
      <Icon size={22} color={color} fill={active ? color : 'none'} strokeWidth={2.25} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: { backgroundColor: colors.surface.raised, boxShadow: shadow.floating },
});
