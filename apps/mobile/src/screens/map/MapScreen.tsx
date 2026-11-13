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
  setPlacesScript,
  showUserScript,
} from '@/features/map/map-html';
import { firstIndexAtPlace, mapOffers } from '@/features/map/map-logic';
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
import { colors, duration, layout, radii, shadow, space } from '@/theme';

const MAP_HTML = buildMapHtml({
  styleUrl: env.mapStyleUrl,
  colors: {
    pin: colors.accent.solid,
    // Gewählte Nadel: sanftes Koralle (und etwas größer). Eigener Standort: blauer Punkt.
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
export function MapScreen() {
  const insets = useSafeAreaInsets();
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
  const visible = filterOffers(cityOffers, filters);
  // Nur buchbare Angebote, von West nach Ost. Ausgebuchte erscheinen gar nicht.
  const offers = mapOffers(visible);
  const placesScript = setPlacesScript(groupByPlace(offers));

  // Fällt das gezeigte Angebot durch einen Filter weg, verschwindet auch die Kachel.
  const selectedIndex = selectedId ? offers.findIndex((offer) => offer.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? offers[selectedIndex] : undefined;
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

  // Auf die gewählte Stadt springen (beim Start und nach jedem Wechsel, auch aus „Entdecken“).
  // Kam der Wechsel vom Standort-Knopf, danach gleich zum eigenen Standort weiter.
  const pendingUser = useRef<Coordinates | null>(null);
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

    // Schnellster Weg: Position ist schon bekannt, sofort springen.
    const known = peekPosition();
    if (known) jumpToUser(known);

    // Sonst (oder zum Nachschärfen) orten; bis dahin dreht sich das Symbol im Knopf.
    setLocating(!known);
    const result = await quickPosition();
    setLocating(false);
    if (result.status !== 'ok') {
      if (!known) {
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
      ? `In ${city.name} gibt es gerade noch keine Angebote.`
      : visible.length === 0
        ? 'Für diese Auswahl gibt es gerade kein Angebot.'
        : offers.length === 0
          ? allSoldOut
            ? 'Für diese Auswahl ist gerade alles ausgebucht.'
            : 'Für diese Angebote fehlt noch die genaue Adresse. Du findest sie unter „Entdecken“.'
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
            title="Karte nicht geladen"
            message="Die Karte braucht eine Internetverbindung. Prüf dein Netz und versuch es nochmal."
            actionLabel="Nochmal versuchen"
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
          accessibilityLabel={`Karte von ${city.name} mit Angeboten`}
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
                Filter zurücksetzen
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
              accessibilityLabel="Meinen Standort anzeigen"
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
                offers={offers}
                index={selectedIndex}
                onIndexChange={(index) => {
                  const offer = offers[index];
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
        title={notice === 'denied' ? 'Standort nicht freigegeben' : 'Standort nicht gefunden'}
        onDismiss={() => setNotice(null)}
      >
        <Text variant="body" color="secondary">
          {notice === 'denied'
            ? 'Wenn du magst, zeigen wir dir, was in deiner Nähe ist. Erlaube dafür den Standort in den Einstellungen deines Handys. Die Karte funktioniert auch ohne.'
            : 'Wir konnten deinen Standort gerade nicht bestimmen. Versuch es gleich nochmal.'}
        </Text>
        <Button label="Okay" fullWidth onPress={() => noticeSheet.current?.dismiss()} />
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
