import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS, type OfferCategory } from '@repo/shared';
import {
  ChefHat,
  Drama,
  Dumbbell,
  LayoutGrid,
  Palette,
  Search,
  Shapes,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, Input } from '@/components/ui';
import { TIME_FILTER_LABELS, TIME_FILTERS } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { layout, space } from '@/theme';

export const CATEGORY_ICONS = {
  kochen_essen: ChefHat,
  sport_bewegung: Dumbbell,
  kreativ_workshops: Palette,
  wellness_beauty: Sparkles,
  kultur_events: Drama,
  sonstiges: Shapes,
} as const satisfies Record<OfferCategory, LucideIcon>;

export interface FilterBarProps {
  /** Suchfeld weglassen, z. B. auf der Karte. */
  showSearch?: boolean;
}

/** Suche, Zeitfilter und Kategorien. Feed und Karte nutzen dieselben Filter. */
export function FilterBar({ showSearch = true }: FilterBarProps) {
  const { filters, setFilters } = useOfferFilters();

  return (
    <View style={styles.container}>
      {showSearch ? (
        <View style={styles.inset}>
          <Input
            shape="pill"
            icon={Search}
            placeholder="Kochkurs, Yoga, Keramik …"
            accessibilityLabel="Angebote durchsuchen"
            value={filters.query}
            onChangeText={(query) => setFilters({ query })}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {TIME_FILTERS.map((time) => (
          <Chip
            key={time}
            label={TIME_FILTER_LABELS[time]}
            selected={filters.time === time}
            onPress={() => setFilters({ time })}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <Chip
          label="Alle Kategorien"
          icon={LayoutGrid}
          selected={filters.category === null}
          onPress={() => setFilters({ category: null })}
        />
        {OFFER_CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={OFFER_CATEGORY_LABELS[category]}
            icon={CATEGORY_ICONS[category]}
            selected={filters.category === category}
            onPress={() =>
              setFilters({ category: filters.category === category ? null : category })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space[3] },
  inset: { paddingHorizontal: layout.screenPaddingX },
  row: { paddingHorizontal: layout.screenPaddingX, gap: space[2] },
});
