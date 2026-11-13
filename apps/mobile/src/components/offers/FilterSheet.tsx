import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS } from '@repo/shared';
import { LayoutGrid } from 'lucide-react-native';
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Sheet, Text, type SheetRef } from '@/components/ui';
import { TIME_FILTER_LABELS, TIME_FILTERS } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { space } from '@/theme';

import { CATEGORY_ICONS } from './category-icons';

export interface FilterSheetProps {
  sheetRef: RefObject<SheetRef | null>;
}

/** Alle Filter auf einen Blick: Zeit und Kategorie. Änderungen wirken sofort. */
export function FilterSheet({ sheetRef }: FilterSheetProps) {
  const { filters, setFilters, resetFilters } = useOfferFilters();

  return (
    <Sheet ref={sheetRef} title="Filter">
      <View style={styles.group}>
        <Text variant="subhead" color="secondary" accessibilityRole="header">
          Wann
        </Text>
        <View style={styles.wrap}>
          {TIME_FILTERS.map((time) => (
            <Chip
              key={time}
              size="sm"
              label={TIME_FILTER_LABELS[time]}
              selected={filters.time === time}
              onPress={() => setFilters({ time })}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="subhead" color="secondary" accessibilityRole="header">
          Kategorie
        </Text>
        <View style={styles.wrap}>
          <Chip
            size="sm"
            label="Alle"
            icon={LayoutGrid}
            selected={filters.category === null}
            onPress={() => setFilters({ category: null })}
          />
          {OFFER_CATEGORIES.map((category) => (
            <Chip
              key={category}
              size="sm"
              label={OFFER_CATEGORY_LABELS[category]}
              icon={CATEGORY_ICONS[category]}
              selected={filters.category === category}
              onPress={() =>
                setFilters({ category: filters.category === category ? null : category })
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Zurücksetzen"
          variant="secondary"
          onPress={resetFilters}
          style={styles.action}
        />
        <Button label="Fertig" onPress={() => sheetRef.current?.dismiss()} style={styles.action} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  actions: { flexDirection: 'row', gap: space[3], paddingTop: space[2] },
  action: { flex: 1 },
});
