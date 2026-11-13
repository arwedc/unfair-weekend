import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, fonts, layout, space } from '@/theme';

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
  /** Macht die ganze Zeile zum Auf-/Zuklapp-Knopf mit Pfeil rechts (neben `detail`). */
  onToggle?: () => void;
  /** Nur mit `onToggle`: ob der Abschnitt gerade offen ist. */
  expanded?: boolean;
}

/** Überschrift eines Abschnitts, z. B. „Heute in Münster“. Mit `onToggle` auf- und zuklappbar. */
export function SectionHeader({
  title,
  detail,
  inset = false,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  onToggle,
  expanded = false,
}: SectionHeaderProps) {
  if (onToggle) {
    const Chevron = expanded ? ChevronUp : ChevronDown;
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={detail ? `${title}, ${detail}` : title}
        accessibilityState={{ expanded }}
        pressedScale={0.99}
        onPress={onToggle}
        style={[
          styles.row,
          styles.toggleRow,
          inset && { paddingHorizontal: layout.screenPaddingX },
        ]}
      >
        <Text variant="title2" style={styles.title}>
          {title}
        </Text>
        <View style={styles.toggleEnd}>
          {detail ? (
            <Text variant="subhead" color="tertiary">
              {detail}
            </Text>
          ) : null}
          <Chevron size={20} color={colors.text.tertiary} strokeWidth={2.25} />
        </View>
      </PressableScale>
    );
  }

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
  toggleRow: { alignItems: 'center', minHeight: layout.minTouchTarget },
  toggleEnd: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  title: { flexShrink: 1 },
  action: { fontFamily: fonts.semibold },
});
