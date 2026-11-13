import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { CloudOff, LocateFixed } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

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
  parseMapMessage,
  selectPlaceScript,
  setPlacesScript,
  showUserScript,
} from '@/features/map/map-html';
import { firstIndexAtPlace, mapOffers } from '@/features/map/map-logic';
import { groupByPlace, placeKeyOf } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useFilteredOffers } from '@/features/offers/use-filtered-offers';
import { errorMessage } from '@/lib/api-error';
import { env } from '@/lib/env';
import { openWebsite } from '@/lib/open-external';
import { colors, duration, layout, radii, shadow, space } from '@/theme';

const MAP_HTML = buildMapHtml({
  styleUrl: env.mapStyleUrl,
  colors: {
    pin: colors.accent.solid,
    // Gewählte Nadel: leuchtender Markenton statt Schwarz, hebt sich sanft ab (und ist größer).
    pinActive: colors.accent.vivid,
    pinDot: colors.accent.onSolid,
    user: colors.accent.vivid,
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

  const { resetFilters } = useOfferFilters();
  const { data, error, refetch, visible } = useFilteredOffers();

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

  const showMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setNotice('denied');
        noticeSheet.current?.present();
        return;
      }
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      webview.current?.injectJavaScript(
        showUserScript(position.coords.latitude, position.coords.longitude),
      );
    } catch {
      setNotice('failed');
      noticeSheet.current?.present();
    } finally {
      setLocating(false);
    }
  };

  const allSoldOut = visible.length > 0 && visible.every((offer) => offer.free_seats === 0);
  const emptyMessage =
    visible.length === 0
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
          accessibilityLabel="Karte von Münster mit Angeboten"
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
        <FilterBar variant="floating" />
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
            <Text
              variant="footnote"
              color="accent"
              accessibilityRole="button"
              onPress={resetFilters}
              suppressHighlighting
            >
              Filter zurücksetzen
            </Text>
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
              active={locating}
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
