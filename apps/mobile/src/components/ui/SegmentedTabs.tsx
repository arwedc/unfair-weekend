import { StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { colors, fonts, layout, radii, shadow, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface SegmentedTab<K extends string> {
  key: K;
  label: string;
  /** Kleine Zahl hinter dem Label, z. B. Anzahl Favoriten. */
  count?: number;
}

export interface SegmentedTabsProps<K extends string> {
  tabs: readonly SegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
}

/** Umschalter zwischen wenigen Reitern, z. B. „Angebote | Orte“. Aktiv: weiße Pille auf grauer Schiene. */
export function SegmentedTabs<K extends string>({ tabs, value, onChange }: SegmentedTabsProps<K>) {
  return (
    <View style={styles.rail} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <PressableScale
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.count !== undefined ? `${tab.label}, ${tab.count}` : tab.label}
            pressedScale={0.97}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(tab.key);
            }}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text
              variant="subhead"
              style={[
                styles.label,
                { color: selected ? colors.text.primary : colors.text.secondary },
              ]}
            >
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 ? (
              <View style={[styles.count, selected && styles.countSelected]}>
                <Text variant="caption" style={selected ? styles.countTextSelected : undefined}>
                  {tab.count}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    padding: space[1],
    gap: space[1],
    borderRadius: radii.full,
    backgroundColor: colors.background.muted,
  },
  tab: {
    flex: 1,
    minHeight: layout.minTouchTarget - space[1],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1.5],
    borderRadius: radii.full,
  },
  tabSelected: { backgroundColor: colors.surface.raised, boxShadow: shadow.card },
  label: { fontFamily: fonts.semibold },
  count: {
    minWidth: space[5],
    paddingHorizontal: space[1.5],
    borderRadius: radii.full,
    alignItems: 'center',
    backgroundColor: colors.surface.raised,
  },
  countSelected: { backgroundColor: colors.accent.solid },
  countTextSelected: { color: colors.accent.onSolid, fontFamily: fonts.semibold },
});
