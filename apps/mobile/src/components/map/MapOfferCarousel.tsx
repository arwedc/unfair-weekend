import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { snappedIndex } from '@/features/map/map-logic';
import type { Offer } from '@/features/offers/types';
import { space } from '@/theme';

import { MAP_TILE_HEIGHT, MapOfferTile } from './MapOfferTile';

/** So weit ragen die Nachbarkacheln links und rechts ins Bild (zeigt: hier kann man wischen). */
const SIDE = space[6];
const GAP = space[2];

export interface MapOfferCarouselProps {
  offers: readonly Offer[];
  index: number;
  /** Beim Wischen: welche Kachel jetzt (überwiegend) in der Mitte steht. */
  onIndexChange: (index: number) => void;
}

/**
 * Kacheln unten auf der Karte. Eine Kachel pro Angebot, einrastend, die Nachbarn schauen an
 * den Rändern hervor. Wischen wechselt das Angebot, die Karte folgt (über `onIndexChange`).
 *
 * Der Wechsel passiert schon während des Wischens, sobald die nächste Kachel zur Hälfte im Bild
 * ist, nicht erst nach dem Ausrollen. So springt die Nadel ohne spürbare Verzögerung mit.
 */
export function MapOfferCarousel({ offers, index, onIndexChange }: MapOfferCarouselProps) {
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Offer>>(null);
  // Index, den die Liste gerade zeigt. Verhindert, dass ein Wischen sich selbst zurückscrollt.
  const shown = useRef(index);
  // Ziel eines Scrollens von außen (Tipp auf eine Nadel). Bis es erreicht ist, keine Zwischenstände melden.
  const target = useRef<number | null>(null);

  const tileWidth = width - SIDE * 2;
  const interval = tileWidth + GAP;

  // Auswahl kam von außen (Tipp auf eine Nadel): zur passenden Kachel scrollen.
  useEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    target.current = index;
    list.current?.scrollToOffset({ offset: index * interval, animated: true });
  }, [index, interval]);

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={list}
        data={offers}
        keyExtractor={(offer) => offer.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        initialScrollIndex={index}
        getItemLayout={(_, position) => ({
          length: interval,
          offset: interval * position,
          index: position,
        })}
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          target.current = null;
        }}
        onScroll={(event) => {
          const next = snappedIndex(event.nativeEvent.contentOffset.x, interval, offers.length);
          if (target.current !== null) {
            if (next === target.current) target.current = null;
            return;
          }
          if (next === shown.current) return;
          shown.current = next;
          void Haptics.selectionAsync();
          onIndexChange(next);
        }}
        renderItem={({ item, index: position }) => (
          <View style={{ width: interval }}>
            <MapOfferTile
              offer={item}
              width={tileWidth}
              position={`Angebot ${position + 1} von ${offers.length}`}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Platz für den Schatten der Kachel, sonst wird er abgeschnitten.
  wrap: { height: MAP_TILE_HEIGHT + space[6], justifyContent: 'center' },
});
