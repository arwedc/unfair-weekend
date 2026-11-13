import { MenuView } from '@expo/ui/community/menu';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { CITIES, countOffersByCity, isCityId, type CityId } from '@/features/offers/cities';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';

export interface CityMenuProps {
  /** Auslöser, z. B. „Münster ⌄“. Muss eine reine Ansicht sein, kein eigener Button. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Natives Dropdown zur Stadtwahl (iOS: System-Menü mit Häkchen, Android: Material-Menü).
 * Ein Tipp auf den Auslöser öffnet es.
 */
export function CityMenu({ children, style }: CityMenuProps) {
  const { cityId, setCityId } = useOfferFilters();
  const { data } = useOffers();
  const counts = countOffersByCity(data ?? []);

  return (
    <MenuView
      title="Stadt wählen"
      style={style}
      actions={CITIES.map((city) => {
        const count = counts[city.id];
        const suffix = count > 0 ? ` · ${count}` : city.launched ? '' : ' · bald';
        return {
          id: city.id,
          title: `${city.name}${suffix}`,
          image: 'mappin.and.ellipse',
          state: city.id === cityId ? 'on' : 'off',
        };
      })}
      onPressAction={({ nativeEvent }) => {
        if (!isCityId(nativeEvent.event) || nativeEvent.event === cityId) return;
        void Haptics.selectionAsync();
        setCityId(nativeEvent.event);
      }}
    >
      {children}
    </MenuView>
  );
}

/** Erste gestartete Stadt außer der aktuellen, z. B. für „Zu Münster wechseln“. */
export function fallbackCity(currentId: CityId) {
  return CITIES.find((city) => city.launched && city.id !== currentId) ?? CITIES[0];
}
