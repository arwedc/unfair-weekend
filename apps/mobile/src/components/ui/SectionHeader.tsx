import { StyleSheet, View } from 'react-native';

import { fonts, layout, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  /** Kleine Zeile rechts, z. B. die Anzahl. */
  detail?: string;
  /** Seitenrand selbst setzen, wenn der Abschnitt randlos ist (Karussell). */
  inset?: boolean;
  /** Leiser Link rechts, z. B. „Alle“. Ersetzt `detail`. */
  actionLabel?: string;
  onAction?: () => void;
  /** Für Screenreader, z. B. „Alle Angebote aus Kochen & Essen“. */
  actionAccessibilityLabel?: string;
}

/** Überschrift eines Abschnitts, z. B. „Heute in Münster“. */
export function SectionHeader({
  title,
  detail,
  inset = false,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
}: SectionHeaderProps) {
  return (
    <View style={[styles.row, inset && { paddingHorizontal: layout.screenPaddingX }]}>
      <Text variant="title2" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          onPress={onAction}
          hitSlop={ACTION_HIT_SLOP}
        >
          <Text variant="subhead" color="accent" style={styles.action}>
            {actionLabel}
          </Text>
        </PressableScale>
      ) : detail ? (
        <Text variant="subhead" color="tertiary">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Der Link ist klein, die Touch-Fläche trotzdem mindestens 44 pt. */
const ACTION_HIT_SLOP = { top: space[3], bottom: space[3], left: space[4], right: space[4] };

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { flexShrink: 1 },
  action: { fontFamily: fonts.semibold },
});
