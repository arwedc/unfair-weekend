import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, fonts, layout, radius, shadow, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  /** Kleines Icon rechts, z. B. ein Pfeil für „öffnet eine Auswahl“. */
  trailingIcon?: LucideIcon;
  /** Mit Schatten, z. B. schwebend über der Karte. */
  elevated?: boolean;
  /** Für Screenreader, falls der sichtbare Text nicht reicht (z. B. „Filter, 2 aktiv“). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** Filter-Chip (z. B. Kategorien). Aktiv: kräftig in Akzentfarbe, sonst ruhig grau. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon: Icon,
  trailingIcon: TrailingIcon,
  elevated = false,
  accessibilityLabel,
  accessibilityHint,
}: ChipProps) {
  const foreground = selected ? colors.accent.onSolid : colors.text.primary;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      hitSlop={4}
      style={[styles.chip, selected ? styles.selected : styles.idle, elevated && styles.elevated]}
    >
      {Icon ? <Icon size={16} color={foreground} strokeWidth={2.25} /> : null}
      <Text variant="subhead" style={[styles.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
      {TrailingIcon ? <TrailingIcon size={16} color={foreground} strokeWidth={2.25} /> : null}
    </PressableScale>
  );
}

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
  idle: { backgroundColor: colors.surface.default, borderColor: colors.border.default },
  selected: { backgroundColor: colors.accent.solid, borderColor: colors.accent.solid },
  elevated: { borderColor: 'transparent', boxShadow: shadow.card },
  label: { fontFamily: fonts.semibold },
});
