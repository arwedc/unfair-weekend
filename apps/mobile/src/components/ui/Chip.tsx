import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, fonts, layout, radius, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  /** „sm“ = dezente, flache Pille, z. B. für die Filterzeile über dem Feed. */
  size?: 'md' | 'sm';
  accessibilityHint?: string;
}

/** Filter-Chip (z. B. Kategorien). Aktiv: kräftig in Akzentfarbe, sonst ruhig grau. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon: Icon,
  size = 'md',
  accessibilityHint,
}: ChipProps) {
  const foreground = selected ? colors.accent.onSolid : colors.text.primary;
  const small = size === 'sm';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      // Kleine Chips sind 32 pt hoch, der hitSlop ergänzt sie auf die Mindestgröße.
      hitSlop={small ? SMALL_HIT_SLOP : 4}
      style={[styles.chip, small && styles.small, selected ? styles.selected : styles.idle]}
    >
      {Icon ? <Icon size={small ? 14 : 16} color={foreground} strokeWidth={2.25} /> : null}
      <Text
        variant={small ? 'footnote' : 'subhead'}
        style={[styles.label, { color: foreground }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const SMALL_HEIGHT = space[8];
const SMALL_HIT_SLOP = (layout.minTouchTarget - SMALL_HEIGHT) / 2;

const styles = StyleSheet.create({
  chip: {
    minHeight: layout.minTouchTarget - 4,
    paddingHorizontal: space[4],
    borderRadius: radius.button,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
  },
  small: { minHeight: SMALL_HEIGHT, paddingHorizontal: space[3], gap: space[1] },
  idle: { backgroundColor: colors.surface.default, borderColor: colors.border.default },
  selected: { backgroundColor: colors.accent.solid, borderColor: colors.accent.solid },
  label: { fontFamily: fonts.semibold },
});
