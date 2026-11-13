import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS, type OfferCategory } from '@repo/shared';
import { LayoutGrid } from 'lucide-react-native';
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text, type SheetRef } from '@/components/ui';
import { offersInCity } from '@/features/offers/cities';
import {
  countByCategory,
  EMPTY_FILTERS,
  filterOffers,
  TIME_FILTER_LABELS,
  TIME_FILTERS,
} from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import { space } from '@/theme';

import { CATEGORY_ICONS } from './category-icons';
import { FilterTile } from './FilterTile';
import { TIME_ICONS } from './time-icons';

export interface FilterSheetProps {
  sheetRef: RefObject<SheetRef | null>;
}

type CategoryChoice = OfferCategory | null;

/** „Alle“ plus alle Kategorien, in Zweierreihen. */
const CATEGORY_ROWS: CategoryChoice[][] = (() => {
  const choices: CategoryChoice[] = [null, ...OFFER_CATEGORIES];
  const rows: CategoryChoice[][] = [];
  for (let i = 0; i < choices.length; i += 2) rows.push(choices.slice(i, i + 2));
  return rows;
})();

function countLabel(count: number): string {
  return count === 1 ? '1 Angebot' : `${count} Angebote`;
}

/**
 * Alle Filter auf einen Blick: Zeit als Kachelreihe, Kategorien als Kacheln mit Anzahl.
 * Änderungen wirken sofort, unten steht live, wie viele Angebote übrig bleiben.
 */
export function FilterSheet({ sheetRef }: FilterSheetProps) {
  const { filters, setFilters, resetFilters, cityId } = useOfferFilters();
  const { data } = useOffers();

  const cityOffers = offersInCity(data ?? [], cityId);
  // Die Zahlen an den Kategorien folgen dem gewählten Tag (und der Suche), nicht der Kategorie.
  const forCounts = filterOffers(cityOffers, { ...filters, category: null });
  const categoryCounts = countByCategory(forCounts);
  const resultCount = filterOffers(cityOffers, filters).length;
  const changed = filters.time !== EMPTY_FILTERS.time || filters.category !== null;

  return (
    <Sheet ref={sheetRef} title="Was möchtest du erleben?">
      <View style={styles.group}>
        <Text variant="subhead" color="secondary" accessibilityRole="header">
          Wann
        </Text>
        <View style={styles.timeRow}>
          {TIME_FILTERS.map((time) => (
            <FilterTile
              key={time}
              layout="column"
              label={TIME_FILTER_LABELS[time]}
              icon={TIME_ICONS[time]}
              selected={filters.time === time}
              onPress={() => setFilters({ time })}
              style={styles.flex}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text variant="subhead" color="secondary" accessibilityRole="header">
          Kategorie
        </Text>
        {CATEGORY_ROWS.map((row) => (
          <View key={row.map(String).join('-')} style={styles.categoryRow}>
            {row.map((category) => {
              const count = category ? categoryCounts[category] : forCounts.length;
              return (
                <FilterTile
                  key={category ?? 'alle'}
                  label={category ? OFFER_CATEGORY_LABELS[category] : 'Alle Kategorien'}
                  icon={category ? CATEGORY_ICONS[category] : LayoutGrid}
                  detail={countLabel(count)}
                  muted={count === 0}
                  selected={filters.category === category}
                  onPress={() =>
                    setFilters({
                      category:
                        category !== null && filters.category === category ? null : category,
                    })
                  }
                  style={styles.flex}
                />
              );
            })}
            {row.length === 1 ? <View style={styles.flex} /> : null}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {changed ? <Button label="Zurücksetzen" variant="ghost" onPress={resetFilters} /> : null}
        <Button
          label={resultCount === 0 ? 'Keine Angebote' : `${countLabel(resultCount)} anzeigen`}
          onPress={() => sheetRef.current?.dismiss()}
          style={styles.flex}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  timeRow: { flexDirection: 'row', gap: space[2] },
  categoryRow: { flexDirection: 'row', gap: space[2] },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingTop: space[2] },
});
