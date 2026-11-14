import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { colors, layout, radius, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'dark' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Volle Breite, z. B. für die Hauptaktion unten auf einem Screen. */
  fullWidth?: boolean;
  /** Leichtes haptisches Feedback beim Tippen, nur für Hauptaktionen wie „Code holen“. */
  haptic?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const variantColors: Record<Variant, { background: string; foreground: string; border?: string }> =
  {
    primary: { background: colors.accent.solid, foreground: colors.accent.onSolid },
    /** Schwarz mit weißem Text: ruhige Hauptaktion, z. B. auf der Angebotsseite. */
    dark: { background: colors.background.inverse, foreground: colors.text.inverse },
    secondary: { background: colors.background.muted, foreground: colors.text.primary },
    outline: {
      background: colors.surface.default,
      foreground: colors.text.primary,
      border: colors.border.strong,
    },
    ghost: { background: 'transparent', foreground: colors.text.accent },
    /** Endgültige Aktionen wie „Konto löschen“ oder „Stornieren“. */
    danger: { background: colors.status.error.solid, foreground: colors.status.error.onSolid },
  };

const sizes: Record<Size, { height: number; paddingX: number }> = {
  md: { height: 48, paddingX: space[5] },
  lg: { height: 56, paddingX: space[6] },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const palette = variantColors[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        if (haptic) haptics.tap();
        onPress?.();
      }}
      style={[
        styles.base,
        {
          minHeight: sizes[size].height,
          paddingHorizontal: sizes[size].paddingX,
          backgroundColor: palette.background,
          borderColor: palette.border ?? 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.foreground} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={20} color={palette.foreground} strokeWidth={2.25} /> : null}
          <Text
            variant={size === 'lg' ? 'headline' : 'bodyStrong'}
            style={{ color: palette.foreground }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: layout.minTouchTarget,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
