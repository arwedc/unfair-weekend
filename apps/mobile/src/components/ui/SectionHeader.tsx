import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, fonts, layout, radii, space } from '@/theme';

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
  /** Runder Pfeil rechts, z. B. zur Seite mit allen Angeboten und Karte. Ersetzt den Link. */
  onMore?: () => void;
  /** Für Screenreader, z. B. „Alle Angebote aus Last Minute“. */
  moreAccessibilityLabel?: string;
  /** Kleines Zeichen vor dem Titel, z. B. ein pulsierender Punkt bei „Last Minute“. */
  accessory?: ReactNode;
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
  accessory,
  onMore,
  moreAccessibilityLabel,
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
        <Text variant="title3" style={styles.title}>
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
      <View style={styles.titleWrap}>
        {accessory}
        <Text variant="title3" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      {onMore ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={moreAccessibilityLabel ?? title}
          onPress={onMore}
          hitSlop={MORE_HIT_SLOP}
          pressedScale={0.9}
          style={styles.more}
        >
          <ChevronRight size={18} color={colors.text.primary} strokeWidth={2.5} />
        </PressableScale>
      ) : actionLabel && onAction ? (
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

/** Der Pfeil ist 32 pt groß, die Touch-Fläche trotzdem 44 pt. */
const MORE_SIZE = 32;
const MORE_HIT_SLOP = (44 - MORE_SIZE) / 2;

/** Der Link ist klein, die Touch-Fläche trotzdem mindestens 44 pt. */
const ACTION_HIT_SLOP = { top: space[3], bottom: space[3], left: space[4], right: space[4] };

const styles = StyleSheet.create({
  // Mittig statt an der Grundlinie: Mit der Titelgruppe (Punkt + Text) konnte die Grundlinien-
  // Ausrichtung die Gruppe beim Neuaufbau auf Breite 0 drücken, dann war nur noch der Punkt zu sehen.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  toggleRow: { minHeight: layout.minTouchTarget },
  toggleEnd: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  // Nimmt den freien Platz ein, damit der Titel nie auf 0 schrumpft; „Alle“ bleibt rechts.
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexGrow: 1,
    flexShrink: 1,
  },
  title: { flexShrink: 1 },
  action: { fontFamily: fonts.semibold },
  more: {
    width: MORE_SIZE,
    height: MORE_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.muted,
  },
});
