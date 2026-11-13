import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  LOOP_COPIES,
  nearestLoopPosition,
  realIndex,
  recenteredPosition,
  snappedIndex,
} from '@/features/map/map-logic';
import type { Offer } from '@/features/offers/types';
import { useT } from '@/lib/i18n/context';
import { space } from '@/theme';

import { MAP_TILE_HEIGHT, MapOfferTile } from './MapOfferTile';

/** So weit ragen die Nachbarkacheln links und rechts ins Bild (zeigt: hier kann man wischen). */
const SIDE = space[6];
const GAP = space[2];
/**
 * Luft über und unter der Kachel: Platz für ihren Schatten und Abstand zum Standort-Knopf darüber.
 * Als Innenabstand der Liste, denn die Liste füllt die ganze Höhe und würde die Kachel sonst
 * oben anlegen.
 */
const AIR = space[3];

export interface MapOfferCarouselProps {
  offers: readonly Offer[];
  index: number;
  /** Beim Wischen: welche Kachel jetzt (überwiegend) in der Mitte steht. */
  onIndexChange: (index: number) => void;
}

interface Slot {
  key: string;
  offer: Offer;
}

/**
 * Kacheln unten auf der Karte. Eine Kachel pro Angebot, einrastend, die Nachbarn schauen an
 * den Rändern hervor. Wischen wechselt das Angebot, die Karte folgt (über `onIndexChange`).
 *
 * Endlos: Nach dem letzten Angebot kommt wieder das erste (und umgekehrt). Dafür liegen die
 * Kacheln dreimal hintereinander; nach dem Ausrollen springt die Liste unsichtbar zurück in
 * die mittlere Kopie.
 *
 * Der Wechsel passiert schon während des Wischens, sobald die nächste Kachel zur Hälfte im Bild
 * ist, nicht erst nach dem Ausrollen. So springt die Nadel ohne spürbare Verzögerung mit.
 */
export function MapOfferCarousel({ offers, index, onIndexChange }: MapOfferCarouselProps) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<Slot>>(null);
  const count = offers.length;
  // Mit nur einem Angebot gibt es nichts zu wischen, also auch keine Schleife.
  const loop = count > 1;
  const copies = loop ? LOOP_COPIES : 1;
  const middle = loop ? count : 0;

  // Virtuelle Position, die die Liste gerade zeigt.
  const shown = useRef(middle + index);
  // Ziel eines Scrollens von außen (Tipp auf eine Nadel). Bis es erreicht ist, keine Zwischenstände melden.
  const target = useRef<number | null>(null);

  const tileWidth = width - SIDE * 2;
  const interval = tileWidth + GAP;

  const slots: Slot[] = [];
  for (let copy = 0; copy < copies; copy += 1) {
    for (const offer of offers) slots.push({ key: `${copy}-${offer.id}`, offer });
  }

  // Auswahl kam von außen (Tipp auf eine Nadel): den kurzen Weg zur passenden Kachel scrollen.
  useEffect(() => {
    if (realIndex(shown.current, count) === index) return;
    const next = loop ? nearestLoopPosition(index, shown.current, count) : index;
    shown.current = next;
    target.current = next;
    list.current?.scrollToOffset({ offset: next * interval, animated: true });
  }, [index, interval, count, loop]);

  // Nach dem Ausrollen zurück in die Mitte, damit man in beide Richtungen weiterwischen kann.
  const recenter = (offsetX: number) => {
    if (!loop) return;
    const position = snappedIndex(offsetX, interval, slots.length);
    const centered = recenteredPosition(position, count);
    if (centered === null) return;
    shown.current = centered;
    list.current?.scrollToOffset({ offset: centered * interval, animated: false });
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={list}
        data={slots}
        keyExtractor={(slot) => slot.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        disableIntervalMomentum
        initialScrollIndex={middle + index}
        getItemLayout={(_, position) => ({
          length: interval,
          offset: interval * position,
          index: position,
        })}
        contentContainerStyle={{ paddingHorizontal: SIDE, paddingVertical: AIR }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          target.current = null;
        }}
        onScroll={(event) => {
          const next = snappedIndex(event.nativeEvent.contentOffset.x, interval, slots.length);
          if (target.current !== null) {
            if (next === target.current) target.current = null;
            return;
          }
          if (next === shown.current) return;
          const changed = realIndex(next, count) !== realIndex(shown.current, count);
          shown.current = next;
          if (!changed) return;
          onIndexChange(realIndex(next, count));
        }}
        onMomentumScrollEnd={(event) => recenter(event.nativeEvent.contentOffset.x)}
        renderItem={({ item, index: position }) => (
          <View style={{ width: interval }}>
            <MapOfferTile
              offer={item.offer}
              width={tileWidth}
              position={t.parts.card.position(realIndex(position, count) + 1, count)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: MAP_TILE_HEIGHT + AIR * 2 },
});
