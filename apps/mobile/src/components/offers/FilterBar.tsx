import { OFFER_CATEGORY_LABELS } from '@repo/shared';
import { MapPin, SlidersHorizontal } from 'lucide-react-native';
import { useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip, type SheetRef } from '@/components/ui';
import { getCity } from '@/features/offers/cities';
import { TIME_FILTER_LABELS, TIME_FILTERS } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { layout, space } from '@/theme';

import { CATEGORY_ICONS } from './category-icons';
import { CitySheet } from './CitySheet';
import { FilterSheet } from './FilterSheet';

export { CATEGORY_ICONS } from './category-icons';

/** Direkt in der Zeile: alles außer „Alle“. Ein zweiter Tipp auf den aktiven Tag hebt ihn auf. */
const QUICK_TIMES = TIME_FILTERS.filter((time) => time !== 'alle');

export interface FilterBarProps {
  /** Stadt als erste Pille, z. B. auf der Karte (im Feed steht sie in der Kopfzeile). */
  showCity?: boolean;
}

/**
 * Eine schlanke Filterzeile für Feed und Karte (beide teilen denselben Stand):
 * „Filter“ öffnet Zeit und Kategorie im Bottom Sheet, daneben die Tage zum schnellen Umschalten.
 * Ist eine Kategorie gewählt, steht sie statt „Filter“ in der ersten Pille.
 */
export function FilterBar({ showCity = false }: FilterBarProps) {
  const { filters, setFilters, cityId } = useOfferFilters();
  const filterSheet = useRef<SheetRef>(null);
  const citySheet = useRef<SheetRef>(null);
  const category = filters.category;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {showCity ? (
          <Chip
            size="sm"
            label={getCity(cityId).name}
            icon={MapPin}
            accessibilityHint="Öffnet die Auswahl der Städte"
            onPress={() => citySheet.current?.present()}
          />
        ) : null}
        <Chip
          size="sm"
          label={category ? OFFER_CATEGORY_LABELS[category] : 'Filter'}
          icon={category ? CATEGORY_ICONS[category] : SlidersHorizontal}
          selected={category !== null}
          accessibilityHint="Öffnet Zeit- und Kategoriefilter"
          onPress={() => filterSheet.current?.present()}
        />
        {QUICK_TIMES.map((time) => (
          <Chip
            key={time}
            size="sm"
            label={TIME_FILTER_LABELS[time]}
            selected={filters.time === time}
            onPress={() => setFilters({ time: filters.time === time ? 'alle' : time })}
          />
        ))}
      </ScrollView>

      <FilterSheet sheetRef={filterSheet} />
      {showCity ? <CitySheet sheetRef={citySheet} /> : null}
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
});
