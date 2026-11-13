import * as Haptics from 'expo-haptics';
import { CloudOff, LocateFixed } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { MapSearchBar } from '@/components/map/MapSearchBar';
import { MapOfferCarousel } from '@/components/map/MapOfferCarousel';
import { FilterBar } from '@/components/offers/FilterBar';
import {
  Button,
  EmptyState,
  IconButton,
  Sheet,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import {
  buildMapHtml,
  MAP_PALETTE,
  parseMapMessage,
  selectPlaceScript,
  setCenterScript,
  setCitiesScript,
  setPlacesScript,
  showUserScript,
} from '@/features/map/map-html';
import {
  citySummaries,
  firstIndexAtPlace,
  mapOffers,
  sameCityOffers,
} from '@/features/map/map-logic';
import { getCity, nearestCityId, offersInCity } from '@/features/offers/cities';
import { filterOffers, groupByPlace, placeKeyOf } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import { errorMessage } from '@/lib/api-error';
import { env } from '@/lib/env';
import {
  peekPosition,
  quickPosition,
  watchPositionWhileOpen,
  type Coordinates,
} from '@/lib/location';
import { openWebsite } from '@/lib/open-external';
import { useT } from '@/lib/i18n/context';
import { colors, duration, layout, radii, shadow, space } from '@/theme';

const MAP_HTML = buildMapHtml({
  styleUrl: env.mapStyleUrl,
  colors: {
    pin: colors.accent.solid,
    // Gewählte Nadel: helleres Gold (und etwas größer). Eigener Standort: blauer Punkt.
    pinActive: MAP_PALETTE.pinSelected,
    pinDot: colors.accent.onSolid,
    user: MAP_PALETTE.userLocation,
    background: colors.background.muted,
  },
});

type LocationNotice = 'denied' | 'failed' | null;

// Die Typen der Bibliothek brauchen einen Typparameter, sonst gelten alle Props als unzulässig.
type MapWebView = WebView<object>;

/**
 * Tab „Karte“: jedes Angebot mit freien Plätzen als Nadel (passend zu den Filtern).
 * Tipp auf eine Nadel zeigt unten eine Kachel; Wischen führt zum Angebot links oder rechts daneben.
 */
/** Länger dreht sich der Ladekreis im Standort-Knopf nie (falls die Karte nichts meldet). */
const LOCATING_MAX_MS = 12_000;

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const m = t.parts.map;
  const webview = useRef<MapWebView>(null);
  const noticeSheet = useRef<SheetRef>(null);

  const { filters, resetFilters, cityId, setCityId } = useOfferFilters();
  const { data, error, refetch } = useOffers();

  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<LocationNotice>(null);
  // Maße für den Kartenausschnitt: Höhe des Screens, Unterkante der Suchleiste, Oberkante unten.
  const [screenHeight, setScreenHeight] = useState(0);
  const [topInset, setTopInset] = useState(0);
  const [bottomTop, setBottomTop] = useState(0);

  const city = getCity(cityId);
  const cityOffers = offersInCity(data ?? [], cityId);
  // Für Hinweise („In Vilnius gibt es noch nichts …“) zählt nur die gewählte Stadt.
  const visible = filterOffers(cityOffers, filters);
  const cityPinned = mapOffers(visible);
  // Auf der Karte stehen die Nadeln aller Städte (Filter gelten, die Stadtwahl nicht).
  // Nur buchbare Angebote, von West nach Ost. Ausgebuchte erscheinen gar nicht.
  const offers = mapOffers(filterOffers(data ?? [], filters));
  const placesScript = setPlacesScript(groupByPlace(offers));
  // Weite Ansicht: eine Sammelnadel pro Stadt.
  const citiesScript = setCitiesScript(citySummaries(offers));

  // Fällt das gezeigte Angebot durch einen Filter weg, verschwindet auch die Kachel.
  const selected = selectedId ? offers.find((offer) => offer.id === selectedId) : undefined;
  // Gewischt wird durch die Angebote der Stadt, in der die gezeigte Nadel steht.
  const carouselOffers = sameCityOffers(offers, selected);
  const selectedIndex = selected ? carouselOffers.indexOf(selected) : -1;
  const selectedKey = selected ? placeKeyOf(selected) : null;
  const padding = {
    top: topInset + space[4],
    bottom: selected && bottomTop > 0 ? screenHeight - bottomTop + space[6] : space[6],
  };
  const selectScript = selectPlaceScript(selectedKey, padding);

  // Nadeln neu setzen, sobald die Karte bereit ist oder sich Angebote bzw. Filter ändern.
  useEffect(() => {
    if (mapReady) webview.current?.injectJavaScript(placesScript);
  }, [mapReady, placesScript]);
  useEffect(() => {
    if (mapReady) webview.current?.injectJavaScript(citiesScript);
  }, [mapReady, citiesScript]);

  // Auf die gewählte Stadt springen (beim Start und nach jedem Wechsel, auch aus „Entdecken“).
  // Kam der Wechsel vom Standort-Knopf, danach gleich zum eigenen Standort weiter.
  const pendingUser = useRef<Coordinates | null>(null);
  // Sicherheitsnetz: Meldet die Karte nichts zurück, verschwindet der Ladekreis trotzdem.
  const locatingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (locatingTimeout.current) clearTimeout(locatingTimeout.current);
    },
    [],
  );
  const centerScript = setCenterScript(city.center.lat, city.center.lng);
  useEffect(() => {
    if (!mapReady) return;
    const user = pendingUser.current;
    if (user) {
      // Wechsel kam vom Standort-Knopf: gleich zum Standort, die Stadtmitte überspringen.
      pendingUser.current = null;
      webview.current?.injectJavaScript(showUserScript(user.lat, user.lng));
      return;
    }
    webview.current?.injectJavaScript(centerScript);
  }, [mapReady, centerScript]);

  // Ausgewählte Nadel hervorheben und in den sichtbaren Bereich holen.
  useEffect(() => {
    if (mapReady) webview.current?.injectJavaScript(selectScript);
  }, [mapReady, selectScript]);

  const handleMessage = (raw: string) => {
    const message = parseMapMessage(raw);
    if (!message) return;
    switch (message.type) {
      case 'ready':
        setMapReady(true);
        setMapFailed(false);
        break;
      case 'userShown':
        setLocating(false);
        break;
      case 'place': {
        const index = firstIndexAtPlace(offers, message.key);
        const offer = offers[index];
        if (!offer) break;
        void Haptics.selectionAsync();
        // Gleicher Ort wie die gezeigte Kachel: dort bleiben (z. B. 2. Angebot an der Adresse).
        if (selected && placeKeyOf(selected) === message.key) break;
        setSelectedId(offer.id);
        break;
      }
      case 'dismiss':
        setSelectedId(null);
        break;
      case 'link':
        void openWebsite(message.url);
        break;
      case 'error':
        if (!mapReady) setMapFailed(true);
        break;
    }
  };

  const reloadMap = () => {
    setMapFailed(false);
    setMapReady(false);
    setMapKey((key) => key + 1);
    void refetch();
  };

  // Eigener Standort: blauen Punkt zeigen und die Stadt dorthin wechseln. Die Stadt gilt
  // für Karte und „Entdecken“ gemeinsam, der Feed springt also mit.
  // Sofort springen (gemerkte oder letzte bekannte Position), die genaue Ortung setzt den
  // Punkt danach nur noch nach, ohne die Karte erneut zu bewegen.
  // Solange die Karte sichtbar ist, die Position im Hintergrund frisch halten. Dann springt
  // der Knopf sofort, statt erst auf die Ortung zu warten.
  useFocusEffect(useCallback(() => watchPositionWhileOpen(), []));

  const jumpToUser = (coords: Coordinates, move = true) => {
    const nextCity = nearestCityId(coords);
    if (move && nextCity !== cityId) {
      // Die Karte springt im Effekt oben direkt zum Standort (nicht erst zur Stadtmitte).
      pendingUser.current = coords;
      setSelectedId(null);
      setCityId(nextCity);
    } else {
      webview.current?.injectJavaScript(showUserScript(coords.lat, coords.lng, move));
    }
  };

  const showMyLocation = async () => {
    if (locating) return;
    void Haptics.selectionAsync();
    // Ab dem Tippen dreht sich ein Ladekreis im Knopf, bis die Karte meldet, dass sie am
    // Standort steht ('userShown'). So sieht man immer, dass etwas passiert.
    setLocating(true);
    if (locatingTimeout.current) clearTimeout(locatingTimeout.current);
    locatingTimeout.current = setTimeout(() => setLocating(false), LOCATING_MAX_MS);

    // Schnellster Weg: Position ist schon bekannt, sofort springen.
    const known = peekPosition();
    if (known) jumpToUser(known);

    const result = await quickPosition();
    if (result.status !== 'ok') {
      if (!known) {
        setLocating(false);
        setNotice(result.status);
        noticeSheet.current?.present();
      }
      return;
    }
    if (!known) jumpToUser(result.coords);
    void result.refined?.then((coords) => {
      if (coords) jumpToUser(coords, false);
    });
  };

  const allSoldOut = visible.length > 0 && visible.every((offer) => offer.free_seats === 0);
  const emptyMessage =
    cityOffers.length === 0
      ? m.noOffersInCity(city.name)
      : visible.length === 0
        ? m.noneForSelection
        : cityPinned.length === 0
          ? allSoldOut
            ? m.allSoldOut
            : m.noAddress
          : null;

  return (
    <View
      style={styles.screen}
      onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}
    >
      {mapFailed ? (
        <View style={[styles.fallback, { paddingTop: insets.top + space[20] }]}>
          <EmptyState
            tone="error"
            icon={CloudOff}
            title={m.notLoadedTitle}
            message={m.notLoadedText}
            actionLabel={t.common.retry}
            onAction={reloadMap}
          />
        </View>
      ) : (
        <WebView
          key={mapKey}
          ref={webview}
          source={{ html: MAP_HTML }}
          originWhitelist={['*']}
          style={styles.map}
          onMessage={(event) => handleMessage(event.nativeEvent.data)}
          onError={() => setMapFailed(true)}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          accessibilityLabel={m.mapOf(city.name)}
        />
      )}

      {!mapReady && !mapFailed ? (
        <View style={styles.loading} pointerEvents="none">
          <Skeleton height="100%" radius={0} />
        </View>
      ) : null}

      <View
        style={[styles.top, { paddingTop: insets.top + space[2] }]}
        pointerEvents="box-none"
        onLayout={(event) => setTopInset(event.nativeEvent.layout.height)}
      >
        <MapSearchBar>
          {/* Ohne Städtewahl: Die Stadt kommt aus „Entdecken“ oder vom Standort-Knopf. */}
          <FilterBar />
        </MapSearchBar>
        {error ? (
          <View style={styles.banner}>
            <Text variant="footnote" color="secondary">
              {errorMessage(error)}
            </Text>
          </View>
        ) : data && emptyMessage ? (
          <View style={styles.banner}>
            <Text variant="footnote" color="secondary">
              {emptyMessage}
            </Text>
            {visible.length === 0 && cityOffers.length > 0 ? (
              <Text
                variant="footnote"
                color="accent"
                accessibilityRole="button"
                onPress={resetFilters}
                suppressHighlighting
              >
                {m.resetFilters}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Unterer Bereich: SafeAreaView kennt hier auch die Tab-Leiste, die Kachel liegt darüber. */}
      <SafeAreaView
        edges={['bottom']}
        style={styles.bottom}
        pointerEvents="box-none"
        onLayout={(event) => setBottomTop(event.nativeEvent.layout.y)}
      >
        <View pointerEvents="box-none">
          {!mapFailed ? (
            <IconButton
              icon={LocateFixed}
              accessibilityLabel={m.showMyLocation}
              loading={locating}
              onPress={() => void showMyLocation()}
              style={styles.locate}
            />
          ) : null}
          {selected ? (
            <Animated.View
              entering={FadeInDown.duration(duration.base).reduceMotion(ReduceMotion.System)}
              exiting={FadeOutDown.duration(duration.fast).reduceMotion(ReduceMotion.System)}
            >
              <MapOfferCarousel
                // Neue Trefferliste (Filter geändert): Kacheln frisch aufbauen.
                key={carouselOffers.map((offer) => offer.id).join(',')}
                offers={carouselOffers}
                index={selectedIndex}
                onIndexChange={(index) => {
                  const offer = carouselOffers[index];
                  if (!offer) return;
                  void Haptics.selectionAsync();
                  setSelectedId(offer.id);
                }}
              />
            </Animated.View>
          ) : (
            <View style={styles.bottomSpacer} />
          )}
        </View>
      </SafeAreaView>

      <Sheet
        ref={noticeSheet}
        title={notice === 'denied' ? m.deniedTitle : m.notFoundTitle}
        onDismiss={() => setNotice(null)}
      >
        <Text variant="body" color="secondary">
          {notice === 'denied' ? m.deniedText : m.notFoundText}
        </Text>
        <Button label={m.okay} fullWidth onPress={() => noticeSheet.current?.dismiss()} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.muted },
  map: { flex: 1, backgroundColor: colors.background.muted },
  loading: { ...StyleSheet.absoluteFill },
  fallback: { flex: 1, backgroundColor: colors.background.default },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: space[2] },
  banner: {
    marginHorizontal: layout.screenPaddingX,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[1],
    borderRadius: radii.lg,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  locate: { alignSelf: 'flex-end', marginRight: layout.screenPaddingX },
  // Ohne Kachel bleibt der Standort-Knopf mit etwas Abstand über dem unteren Rand.
  bottomSpacer: { height: space[6] },
});
