import * as Haptics from 'expo-haptics';
import { Check, MapPin } from 'lucide-react-native';
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale, Sheet, Text, type SheetRef } from '@/components/ui';
import { CITIES, countOffersByCity, type City } from '@/features/offers/cities';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import { colors, layout, radii, space } from '@/theme';

export interface CitySheetProps {
  sheetRef: RefObject<SheetRef | null>;
}

function cityDetail(city: City, count: number): string {
  if (count > 0) return `${count} ${count === 1 ? 'Angebot' : 'Angebote'}`;
  return city.launched ? 'Gerade keine Angebote' : 'Bald verfügbar';
}

/** Auswahl der Stadt. Feed und Karte zeigen danach nur Angebote dieser Stadt. */
export function CitySheet({ sheetRef }: CitySheetProps) {
  const { cityId, setCityId } = useOfferFilters();
  const { data } = useOffers();
  const counts = countOffersByCity(data ?? []);

  return (
    <Sheet ref={sheetRef} title="Stadt wählen">
      <View style={styles.list}>
        {CITIES.map((city) => {
          const selected = city.id === cityId;
          const detail = cityDetail(city, counts[city.id]);
          return (
            <PressableScale
              key={city.id}
              accessibilityRole="button"
              accessibilityLabel={`${city.name}, ${detail}`}
              accessibilityState={{ selected }}
              onPress={() => {
                void Haptics.selectionAsync();
                setCityId(city.id);
                sheetRef.current?.dismiss();
              }}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={[styles.icon, selected && styles.iconSelected]}>
                <MapPin
                  size={20}
                  strokeWidth={2.25}
                  color={selected ? colors.accent.onSolid : colors.text.secondary}
                />
              </View>
              <View style={styles.text}>
                <Text variant="headline">{city.name}</Text>
                <Text variant="footnote" color="secondary">
                  {detail}
                </Text>
              </View>
              {selected ? <Check size={22} strokeWidth={2.5} color={colors.accent.solid} /> : null}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  row: {
    minHeight: layout.minTouchTarget + space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  rowSelected: { borderColor: colors.accent.solid, backgroundColor: colors.accent.subtle },
  icon: {
    width: layout.minTouchTarget - space[1],
    height: layout.minTouchTarget - space[1],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.muted,
  },
  iconSelected: { backgroundColor: colors.accent.solid },
  text: { flex: 1, gap: space[0.5] },
});
