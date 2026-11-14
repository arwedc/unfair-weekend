import { ChevronDown, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, Text, type SheetRef } from '@/components/ui';
import { getCity } from '@/features/offers/cities';
import { timeFilterLabels, TIME_FILTERS, toggleTime } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, layout, radius, space } from '@/theme';

import { CATEGORY_ICONS } from './category-icons';
import { CityMenu } from './CityMenu';
import { FilterSheet } from './FilterSheet';
import { TIME_ICONS } from './time-icons';

export { CATEGORY_ICONS } from './category-icons';

export interface FilterBarProps {
  /** Stadt als erste Pille, z. B. auf der Karte (im Feed steht sie in der Kopfzeile). */
  showCity?: boolean;
}

/**
 * Eine schlanke Filterzeile für Feed und Karte (beide teilen denselben Stand):
 * „Filter“ öffnet die Kategorien im Bottom Sheet, daneben die Tage zum schnellen Umschalten.
 * Sind Kategorien gewählt, stehen sie (bzw. ihre Anzahl) statt „Filter“ in der ersten Pille.
 * Tage lassen sich mehrfach wählen (z. B. Morgen und Wochenende), ein zweiter Tipp hebt einen auf.
 */
export function FilterBar({ showCity = false }: FilterBarProps) {
  const { t, locale, labels } = useT();
  const m = t.parts.filter;
  const { filters, setFilters, cityId } = useOfferFilters();
  const filterSheet = useRef<SheetRef>(null);
  const { categories } = filters;
  const single = categories.length === 1 ? categories[0] : undefined;
  // Eine Kategorie: ihr Name. Mehrere: „2 Kategorien“. Keine: „Filter“.
  const filterLabel = single
    ? labels.offerCategory[single]
    : categories.length > 1
      ? m.categories(categories.length)
      : m.filter;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {showCity ? (
          <CityMenu>
            <View
              style={styles.cityChip}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Stadt: ${getCity(cityId).name}`}
              accessibilityHint={m.cityHint}
            >
              <MapPin size={14} strokeWidth={2.25} color={colors.text.inverse} />
              <Text variant="footnote" style={styles.cityLabel}>
                {getCity(cityId).name}
              </Text>
              <ChevronDown size={14} strokeWidth={2.5} color={colors.text.inverse} />
            </View>
          </CityMenu>
        ) : null}
        <Chip
          size="sm"
          label={filterLabel}
          icon={single ? CATEGORY_ICONS[single] : SlidersHorizontal}
          selected={categories.length > 0}
          accessibilityHint={m.filterHint}
          onPress={() => filterSheet.current?.present()}
        />
        <View style={styles.divider} />
        {TIME_FILTERS.map((time) => (
          <Chip
            key={time}
            size="sm"
            label={timeFilterLabels(locale)[time]}
            icon={TIME_ICONS[time]}
            selected={filters.times.includes(time)}
            onPress={() => setFilters({ times: toggleTime(filters.times, time) })}
          />
        ))}
      </ScrollView>

      <FilterSheet sheetRef={filterSheet} />
    </>
  );
}

const styles = StyleSheet.create({
  // Oben und unten Luft, damit der hitSlop der kleinen Pillen innerhalb der ScrollView liegt.
  row: {
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: space[1.5],
    gap: space[2],
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: space[5],
    backgroundColor: colors.border.strong,
  },
  cityChip: {
    minHeight: space[8],
    paddingHorizontal: space[3],
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: colors.background.inverse,
  },
  cityLabel: { fontFamily: fonts.semibold, color: colors.text.inverse },
});
