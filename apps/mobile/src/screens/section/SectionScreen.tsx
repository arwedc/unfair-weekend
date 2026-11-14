/**
 * Abschnitts-Seite („Auf der Karte“ neben einer Feed-Reihe): die Karte füllt den Bildschirm,
 * darüber liegt die Liste als ziehbares Blatt mit drei Stufen.
 *  - klein: Titel und das oberste Angebot, die Karte ist fast ganz frei
 *  - mittel: Karte und Liste teilen sich den Bildschirm (Start)
 *  - groß: die ganze Liste; der Knopf „Karte“ holt die Karte zurück
 * Tippen auf eine Nadel scrollt das passende Angebot nach oben und hebt es hervor.
 */
import * as Haptics from 'expo-haptics';
import { ChevronLeft, CloudOff, Map as MapIcon, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { scheduleOnRN } from 'react-native-worklets';

import { OfferListRow, OfferListRowSkeleton } from '@/components/offers/OfferListRow';
import { EmptyState, IconButton, PressableScale, Text } from '@/components/ui';
import { APP_MAP_HTML } from '@/features/map/app-map-html';
import {
  fitPlacesScript,
  parseMapMessage,
  selectPlaceScript,
  setPlacesScript,
} from '@/features/map/map-html';
import {
  clampSheetTop,
  pickSnap,
  SHEET_COLLAPSED,
  SHEET_EXPANDED,
  SHEET_MIDDLE,
  sheetSnaps,
} from '@/features/map/sheet-logic';
import { groupByPlace, placeKeyOf } from '@/features/offers/feed-logic';
import { useSectionOffers } from '@/features/offers/use-section-offers';
import { errorMessage, isOffline } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, layout, radii, shadow, space } from '@/theme';

type MapWebView = WebView<object>;

/** Ruhige Feder ohne Nachschwingen, wie bei System-Sheets. */
const SHEET_SPRING = { damping: 32, stiffness: 320, mass: 1 } as const;
/** Schätzwerte, bis Kopf und erste Zeile gemessen sind. */
const DEFAULT_HEAD = 96;
const DEFAULT_ROW = 128;
/** Weiter als so viele Punkte über den Listenanfang gezogen: Blatt auf „mittel“ verkleinern. */
const PULL_DOWN_TO_SHRINK = 56;

export function SectionScreen({ sectionKey }: { sectionKey: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { t } = useT();
  const m = t.screens.section;
  const { title, offers, error, isPending, refetch } = useSectionOffers(sectionKey);

  const webview = useRef<MapWebView>(null);
  const list = useRef<FlatList<(typeof offers)[number]>>(null);
  const [mapReady, setMapReady] = useState(false);
  // Erst sichtbar, wenn der Ausschnitt auf den Angeboten liegt (sonst blitzt der Startpunkt Münster auf).
  const [mapFitted, setMapFitted] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [snap, setSnap] = useState(SHEET_MIDDLE);
  const [headHeight, setHeadHeight] = useState(DEFAULT_HEAD);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW);

  const snaps = sheetSnaps({
    screenHeight: height,
    topInset: insets.top,
    bottomInset: insets.bottom,
    headHeight,
    rowHeight,
  });
  const [expandedTop, middleTop, collapsedTop] = snaps;

  // Obere Kante des Blatts in Punkten vom Bildschirmrand.
  const sheetTop = useSharedValue(middleTop);
  const dragStart = useSharedValue(0);

  const places = groupByPlace(offers);
  const placesScript = setPlacesScript(places);
  // Ausschnitt für die Startstufe „mittel“: Nadeln zwischen Zurück-Knopf und Blatt.
  const fitScript = fitPlacesScript(places, {
    top: insets.top + space[16],
    bottom: height - middleTop + space[4],
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

  // Stufen ändern sich, wenn Kopf oder Zeile gemessen sind: Blatt an seiner Stufe halten.
  useEffect(() => {
    sheetTop.set(snaps[snap] ?? middleTop);
    // Nur bei neuen Maßen, nicht bei jedem Stufenwechsel (der animiert selbst).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedTop, middleTop, collapsedTop]);

  const snapTo = (index: number) => {
    const target = snaps[index] ?? middleTop;
    sheetTop.set(reduceMotion ? withTiming(target) : withSpring(target, SHEET_SPRING));
    if (index !== snap) void Haptics.selectionAsync();
    setSnap(index);
  };

  // Nach dem Loslassen (aus dem Gesten-Worklet aufgerufen): nur Stufe merken.
  const settle = (index: number) => {
    if (index !== snap) void Haptics.selectionAsync();
    setSnap(index);
  };

  // Verlässt das Blatt die große Stufe, beginnt die Liste wieder oben (oberstes Angebot sichtbar).
  useEffect(() => {
    if (snap !== SHEET_EXPANDED) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [snap]);

  const panConfig = (enabled: boolean) => ({
    enabled,
    activeOffsetY: [-8, 8] as [number, number],
    failOffsetX: [-16, 16] as [number, number],
    onActivate: () => {
      'worklet';
      cancelAnimation(sheetTop);
      dragStart.set(sheetTop.get());
    },
    onUpdate: (event: { translationY: number }) => {
      'worklet';
      sheetTop.set(clampSheetTop(dragStart.get() + event.translationY, expandedTop, collapsedTop));
    },
    onDeactivate: (event: { velocityY: number }) => {
      'worklet';
      const index = pickSnap(sheetTop.get(), event.velocityY, snaps);
      const target = snaps[index] ?? middleTop;
      sheetTop.set(
        reduceMotion
          ? withTiming(target)
          : withSpring(target, { ...SHEET_SPRING, velocity: event.velocityY }),
      );
      scheduleOnRN(settle, index);
    },
  });
  // Griff und Titel ziehen immer; die Liste zieht das Blatt nur, solange sie nicht groß ist
  // (groß scrollt sie stattdessen).
  const handlePan = usePanGesture(panConfig(true));
  const listPan = usePanGesture(panConfig(snap !== SHEET_EXPANDED));

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTop.get() }] }));
  // Groß: oben weiße Fläche statt Kartenstreifen, wie eine eigene Listenseite.
  const coverStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetTop.get(), [expandedTop, middleTop], [1, 0], 'clamp'),
  }));

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
        selectPlaceScript(message.key, {
          top: insets.top + space[16],
          bottom: height - (snaps[snap] ?? middleTop),
        }),
      );
      // Das passende Angebot ganz nach oben holen, auch in der kleinen Stufe.
      const index = offers.findIndex((offer) => placeKeyOf(offer) === message.key);
      if (index >= 0) list.current?.scrollToIndex({ index, animated: true, viewOffset: 0 });
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onHeadLayout = (event: LayoutChangeEvent) =>
    setHeadHeight(Math.round(event.nativeEvent.layout.height));
  const onFirstRowLayout = (event: LayoutChangeEvent) =>
    setRowHeight(Math.round(event.nativeEvent.layout.height));

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

  return (
    <View style={styles.screen}>
      {hasOffers ? (
        <View style={styles.mapWrap}>
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

      <Animated.View
        pointerEvents="none"
        style={[styles.cover, { height: expandedTop + radii['2xl'] }, coverStyle]}
      />

      <Animated.View style={[styles.sheet, { height: height - expandedTop }, sheetStyle]}>
        <GestureDetector gesture={handlePan}>
          <View onLayout={onHeadLayout}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={snap === SHEET_EXPANDED ? m.showMapAria : m.expandAria}
              onPress={() =>
                snapTo(
                  snap === SHEET_COLLAPSED
                    ? SHEET_MIDDLE
                    : snap === SHEET_MIDDLE
                      ? SHEET_EXPANDED
                      : SHEET_MIDDLE,
                )
              }
              pressedScale={1}
              style={styles.grabberHit}
            >
              <View style={styles.grabber} />
            </PressableScale>
            <View style={styles.header}>
              <Text variant="title1" accessibilityRole="header" numberOfLines={2}>
                {title}
              </Text>
              {!isPending && hasOffers ? (
                <Text variant="subhead" color="secondary">
                  {m.count(offers.length)}
                </Text>
              ) : null}
            </View>
          </View>
        </GestureDetector>

        <GestureDetector gesture={listPan}>
          <FlatList
            ref={list}
            data={isPending ? [] : offers}
            keyExtractor={(offer) => offer.id}
            renderItem={({ item, index }) => (
              <View onLayout={index === 0 ? onFirstRowLayout : undefined}>
                <OfferListRow
                  offer={item}
                  highlighted={selectedKey !== null && placeKeyOf(item) === selectedKey}
                />
              </View>
            )}
            ListEmptyComponent={empty}
            ItemSeparatorComponent={Separator}
            onScrollToIndexFailed={({ averageItemLength, index }) =>
              list.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })
            }
            scrollEnabled={snap === SHEET_EXPANDED}
            onScrollEndDrag={(event) => {
              // Groß und über den Listenanfang hinaus nach unten gezogen: wieder auf „mittel“.
              if (
                snap === SHEET_EXPANDED &&
                event.nativeEvent.contentOffset.y < -PULL_DOWN_TO_SHRINK
              ) {
                snapTo(SHEET_MIDDLE);
              }
            }}
            style={styles.list}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[20] }]}
            showsVerticalScrollIndicator={false}
          />
        </GestureDetector>
      </Animated.View>

      <IconButton
        icon={ChevronLeft}
        accessibilityLabel={m.back}
        onPress={back}
        style={[styles.back, { top: insets.top + space[2] }]}
      />

      {hasOffers && snap === SHEET_EXPANDED ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={m.showMapAria}
          onPress={() => snapTo(SHEET_MIDDLE)}
          style={[styles.toggle, { bottom: insets.bottom + space[4] }]}
        >
          <MapIcon size={18} color={colors.text.inverse} strokeWidth={2.5} />
          <Text variant="subhead" style={styles.toggleText}>
            {m.showMap}
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
  mapWrap: { ...StyleSheet.absoluteFill, backgroundColor: colors.background.muted },
  map: { flex: 1, backgroundColor: colors.background.muted },
  mapLoading: { opacity: 0 },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.default,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.default,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderCurve: 'continuous',
    boxShadow: shadow.sheet,
  },
  grabberHit: { alignItems: 'center', paddingTop: space[2], paddingBottom: space[3] },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.border.strong,
  },
  header: {
    gap: space[1],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[3],
  },
  list: { flex: 1 },
  content: { paddingHorizontal: layout.screenPaddingX - space[2] },
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
