/**
 * Abschnitts-Seite (Pfeil neben einer Feed-Reihe): oben die Karte mit den Nadeln dieses
 * Abschnitts, darunter alle Angebote als Liste. Ein Knopf unten blendet die Karte aus und ein.
 * Tippen auf eine Nadel hebt die passenden Angebote in der Liste hervor.
 */
import * as Haptics from 'expo-haptics';
import { ChevronLeft, CloudOff, List, Map as MapIcon, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import { OfferListRow, OfferListRowSkeleton } from '@/components/offers/OfferListRow';
import { EmptyState, IconButton, PressableScale, Text } from '@/components/ui';
import { APP_MAP_HTML } from '@/features/map/app-map-html';
import {
  fitPlacesScript,
  parseMapMessage,
  selectPlaceScript,
  setPlacesScript,
} from '@/features/map/map-html';
import { groupByPlace, placeKeyOf } from '@/features/offers/feed-logic';
import { useSectionOffers } from '@/features/offers/use-section-offers';
import { errorMessage, isOffline } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, layout, radii, shadow, space } from '@/theme';

type MapWebView = WebView<object>;

/** Die Liste überlappt die Karte etwas, damit es wie ein Blatt über der Karte wirkt. */
const SHEET_OVERLAP = space[5];

export function SectionScreen({ sectionKey }: { sectionKey: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { t } = useT();
  const m = t.screens.section;
  const { title, offers, error, isPending, refetch } = useSectionOffers(sectionKey);

  const webview = useRef<MapWebView>(null);
  const list = useRef<FlatList<(typeof offers)[number]>>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  // Erst sichtbar, wenn der Ausschnitt auf den Angeboten liegt (sonst blitzt der Startpunkt Münster auf).
  const [mapFitted, setMapFitted] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const mapHeight = Math.round(height * 0.42);
  const places = groupByPlace(offers);
  const placesScript = setPlacesScript(places);
  const fitScript = fitPlacesScript(places, {
    top: insets.top + space[16],
    bottom: SHEET_OVERLAP + space[6],
  });

  // Nadeln setzen und den Ausschnitt so wählen, dass alle zu sehen sind.
  useEffect(() => {
    if (!mapReady) return;
    webview.current?.injectJavaScript(placesScript);
    webview.current?.injectJavaScript(fitScript);
    // Kurz warten, bis die Karte den neuen Ausschnitt gezeichnet hat, dann einblenden.
    const timer = setTimeout(() => setMapFitted(true), 120);
    return () => clearTimeout(timer);
  }, [mapReady, placesScript, fitScript]);

  const handleMessage = (raw: string) => {
    const message = parseMapMessage(raw);
    if (!message) return;
    if (message.type === 'ready') setMapReady(true);
    if (message.type === 'dismiss') {
      setSelectedKey(null);
      webview.current?.injectJavaScript(selectPlaceScript(null, { top: 0, bottom: 0 }));
    }
    if (message.type === 'place') {
      void Haptics.selectionAsync();
      setSelectedKey(message.key);
      webview.current?.injectJavaScript(
        selectPlaceScript(message.key, { top: insets.top + space[16], bottom: SHEET_OVERLAP }),
      );
      const index = offers.findIndex((offer) => placeKeyOf(offer) === message.key);
      if (index >= 0) list.current?.scrollToIndex({ index, animated: true, viewOffset: space[4] });
    }
  };

  const toggleMap = () => {
    void Haptics.selectionAsync();
    // Die Karte bleibt geladen und wird nur zusammengeklappt. So muss sie beim Einblenden nicht
    // neu starten und zeigt nie kurz den Startpunkt (Münster) statt der gewählten Stadt.
    setMapVisible(!mapVisible);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const header = (
    <View style={styles.header}>
      <Text variant="title1" accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
      {!isPending && offers.length > 0 ? (
        <Text variant="subhead" color="secondary">
          {m.count(offers.length)}
        </Text>
      ) : null}
    </View>
  );

  const empty = isPending ? (
    <View style={styles.skeletons}>
      <OfferListRowSkeleton />
      <OfferListRowSkeleton />
      <OfferListRowSkeleton />
    </View>
  ) : error ? (
    <EmptyState
      tone="error"
      icon={CloudOff}
      title={isOffline(error) ? t.common.noNetwork : t.common.failed}
      message={errorMessage(error)}
      actionLabel={t.common.retry}
      onAction={() => void refetch()}
    />
  ) : (
    <EmptyState icon={Sparkles} title={m.emptyTitle} message={m.emptyText} />
  );

  const hasOffers = offers.length > 0;
  const showMap = mapVisible && hasOffers;

  return (
    <View style={styles.screen}>
      {hasOffers ? (
        <View
          style={[styles.mapWrap, { height: mapHeight }, !showMap && styles.mapHidden]}
          pointerEvents={showMap ? 'auto' : 'none'}
          importantForAccessibility={showMap ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!showMap}
        >
          <WebView<object>
            ref={webview}
            source={{ html: APP_MAP_HTML }}
            originWhitelist={['*']}
            style={[styles.map, !mapFitted && styles.mapLoading]}
            onMessage={(event) => handleMessage(event.nativeEvent.data)}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            setSupportMultipleWindows={false}
            accessibilityLabel={m.showMapAria}
          />
        </View>
      ) : null}

      <FlatList
        ref={list}
        data={isPending ? [] : offers}
        keyExtractor={(offer) => offer.id}
        renderItem={({ item }) => (
          <OfferListRow
            offer={item}
            highlighted={selectedKey !== null && placeKeyOf(item) === selectedKey}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={Separator}
        onScrollToIndexFailed={({ averageItemLength, index }) =>
          list.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })
        }
        style={[
          styles.sheet,
          showMap
            ? { marginTop: mapHeight - SHEET_OVERLAP }
            : { paddingTop: insets.top + space[12] },
        ]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[20] }]}
        showsVerticalScrollIndicator={false}
      />

      <IconButton
        icon={ChevronLeft}
        accessibilityLabel={m.back}
        onPress={back}
        style={[styles.back, { top: insets.top + space[2] }]}
      />

      {offers.length > 0 ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={mapVisible ? m.showListAria : m.showMapAria}
          onPress={toggleMap}
          style={[styles.toggle, { bottom: insets.bottom + space[4] }]}
        >
          {mapVisible ? (
            <List size={18} color={colors.text.inverse} strokeWidth={2.5} />
          ) : (
            <MapIcon size={18} color={colors.text.inverse} strokeWidth={2.5} />
          )}
          <Text variant="subhead" style={styles.toggleText}>
            {mapVisible ? m.showList : m.showMap}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  mapWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.muted,
  },
  map: { flex: 1, backgroundColor: colors.background.muted },
  // Unsichtbar, aber geladen: Nadeln und Ausschnitt bleiben erhalten.
  mapHidden: { opacity: 0 },
  mapLoading: { opacity: 0 },
  sheet: {
    flex: 1,
    backgroundColor: colors.background.default,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderCurve: 'continuous',
  },
  content: { paddingHorizontal: layout.screenPaddingX - space[2], paddingTop: space[5] },
  header: { gap: space[1], paddingHorizontal: space[2], paddingBottom: space[3] },
  skeletons: { gap: space[3] },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: space[2],
    marginVertical: space[1],
    backgroundColor: colors.border.subtle,
  },
  back: { position: 'absolute', left: layout.screenPaddingX },
  toggle: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[5],
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.background.inverse,
    boxShadow: shadow.floating,
  },
  toggleText: { fontFamily: fonts.bold, color: colors.text.inverse },
});
