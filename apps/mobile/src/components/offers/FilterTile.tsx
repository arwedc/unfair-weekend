import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { colors, fonts, layout, radii, space } from '@/theme';

export interface FilterTileProps {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
  /** Kleine Zeile unter dem Label, z. B. „4 Angebote“. */
  detail?: string;
  /** „column“ = Icon über dem Text (schmale Kacheln), „row“ = Icon links. */
  layout?: 'row' | 'column';
  /** Gedimmt, wenn es dafür gerade nichts gibt (bleibt antippbar). */
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Große, antippbare Filterkachel mit Icon. Aktiv: Akzentrahmen und zarte Akzentfläche. */
export function FilterTile({
  label,
  icon: Icon,
  selected,
  onPress,
  detail,
  layout: direction = 'row',
  muted = false,
  style,
}: FilterTileProps) {
  const iconColor = selected ? colors.accent.onSolid : colors.text.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.tile,
        direction === 'column' ? styles.column : styles.row,
        selected ? styles.selected : styles.idle,
        muted && !selected && styles.muted,
        style,
      ]}
    >
      <View style={[styles.icon, selected && styles.iconSelected]}>
        <Icon size={18} strokeWidth={2.25} color={iconColor} />
      </View>
      <View style={direction === 'column' ? styles.textCenter : styles.text}>
        <Text
          variant="footnote"
          numberOfLines={direction === 'column' ? 1 : 2}
          align={direction === 'column' ? 'center' : undefined}
          style={[styles.label, selected && styles.labelSelected]}
        >
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" color="tertiary" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const ICON_SIZE = space[8] + space[1];

const styles = StyleSheet.create({
  tile: {
    minHeight: layout.minTouchTarget + space[4],
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[2] },
  column: { alignItems: 'center', justifyContent: 'center', gap: space[1.5], padding: space[2] },
  idle: { backgroundColor: colors.background.subtle, borderColor: colors.border.subtle },
  selected: { backgroundColor: colors.accent.subtle, borderColor: colors.accent.solid },
  muted: { opacity: 0.55 },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.default,
  },
  iconSelected: { backgroundColor: colors.accent.solid },
  text: { flex: 1, gap: space[0.5] },
  textCenter: { alignItems: 'center', gap: space[0.5] },
  label: { fontFamily: fonts.semibold, color: colors.text.primary },
  labelSelected: { color: colors.text.accent },
});
