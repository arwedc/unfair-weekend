import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { CloudOff, LocateFixed } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { FilterBar } from '@/components/offers/FilterBar';
import { COMPACT_CARD_WIDTH, OfferCard } from '@/components/offers/OfferCard';
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
  setCenterScript,
  setPlacesScript,
  showUserScript,
} from '@/features/map/map-html';
import { getCity, offersInCity } from '@/features/offers/cities';
import { filterOffers, groupByPlace, type OfferPlace } from '@/features/offers/feed-logic';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffers } from '@/features/offers/queries';
import { errorMessage } from '@/lib/api-error';
import { env } from '@/lib/env';
import { openWebsite } from '@/lib/open-external';
import { colors, layout, radii, shadow, space } from '@/theme';

const MAP_HTML = buildMapHtml({
  styleUrl: env.mapStyleUrl,
  colors: {
    pin: colors.accent.solid,
    pinText: colors.accent.onSolid,
    cluster: colors.background.inverse,
    clusterText: colors.text.inverse,
    user: colors.accent.vivid,
    background: colors.background.muted,
  },
});

type LocationNotice = 'denied' | 'failed' | null;

// Die Typen der Bibliothek brauchen einen Typparameter, sonst gelten alle Props als unzulässig.
type MapWebView = WebView<object>;

/** Tab „Karte“: Angebote als Pins mit Rabatt. Tippen öffnet eine Vorschau als Bottom Sheet. */
export function MapScreen() {
  const insets = useSafeAreaInsets();
  const webview = useRef<MapWebView>(null);
  const previewSheet = useRef<SheetRef>(null);
  const noticeSheet = useRef<SheetRef>(null);

  const { filters, resetFilters, cityId } = useOfferFilters();
  const { data, error, refetch } = useOffers();

  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [selected, setSelected] = useState<OfferPlace | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<LocationNotice>(null);

  const city = getCity(cityId);
  const cityOffers = offersInCity(data ?? [], cityId);
  const visible = filterOffers(cityOffers, filters);
  const places = groupByPlace(visible);
  const placesScript = setPlacesScript(places);

  // Pins neu setzen, sobald die Karte bereit ist oder sich Angebote bzw. Filter ändern.
  useEffect(() => {
    if (mapReady) webview.current?.injectJavaScript(placesScript);
  }, [mapReady, placesScript]);

  // Auf die gewählte Stadt springen (beim Start und nach jedem Wechsel).
  const centerScript = setCenterScript(city.center.lat, city.center.lng);
  useEffect(() => {
    if (mapReady) webview.current?.injectJavaScript(centerScript);
  }, [mapReady, centerScript]);

  const handleMessage = (raw: string) => {
    const message = parseMapMessage(raw);
    if (!message) return;
    switch (message.type) {
      case 'ready':
        setMapReady(true);
        setMapFailed(false);
        break;
      case 'place': {
        const place = places.find((item) => item.key === message.key);
        if (!place) break;
        void Haptics.selectionAsync();
        setSelected(place);
        previewSheet.current?.present();
        break;
      }
      case 'dismiss':
        previewSheet.current?.dismiss();
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

  const offerCount = visible.length;
  const hiddenWithoutPin = offerCount > 0 && places.length === 0;

  return (
    <View style={styles.screen}>
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

      <View style={[styles.top, { paddingTop: insets.top + space[2] }]} pointerEvents="box-none">
        <FilterBar showCity />
        {error ? (
          <View style={styles.banner}>
            <Text variant="footnote" color="secondary">
              {errorMessage(error)}
            </Text>
          </View>
        ) : data && (offerCount === 0 || hiddenWithoutPin) ? (
          <View style={styles.banner}>
            <Text variant="footnote" color="secondary">
              {hiddenWithoutPin
                ? 'Für diese Angebote fehlt noch die genaue Adresse. Du findest sie unter „Entdecken“.'
                : cityOffers.length === 0
                  ? `In ${city.name} gibt es gerade noch keine Angebote.`
                  : 'Für diese Auswahl gibt es gerade kein Angebot.'}
            </Text>
            {offerCount === 0 && cityOffers.length > 0 ? (
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

      {!mapFailed ? (
        <IconButton
          icon={LocateFixed}
          accessibilityLabel="Meinen Standort anzeigen"
          active={locating}
          onPress={() => void showMyLocation()}
          style={styles.locate}
        />
      ) : null}

      <Sheet
        ref={previewSheet}
        title={selected?.offers[0]?.location_name}
        onDismiss={() => setSelected(null)}
      >
        {selected && selected.offers.length === 1 && selected.offers[0] ? (
          <OfferCard
            offer={selected.offers[0]}
            onOpen={() => previewSheet.current?.dismiss()}
            priority="high"
          />
        ) : selected ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={COMPACT_CARD_WIDTH + space[3]}
            decelerationRate="fast"
            style={styles.previewScroller}
            contentContainerStyle={styles.previewRow}
          >
            {selected.offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                variant="compact"
                onOpen={() => previewSheet.current?.dismiss()}
              />
            ))}
          </ScrollView>
        ) : null}
      </Sheet>

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
  locate: { position: 'absolute', right: layout.screenPaddingX, bottom: space[10] },
  previewScroller: { marginHorizontal: -layout.screenPaddingX },
  previewRow: { paddingHorizontal: layout.screenPaddingX, gap: space[3] },
});
