/**
 * Abschnitts-Seite („Auf der Karte“ neben einer Feed-Reihe): die Karte füllt den Bildschirm,
 * darüber liegt die Liste als Blatt, das man frei hoch- und runterzieht. Es bleibt dort liegen,
 * wo man es loslässt (mit etwas Schwung). Die Karte ist sichtbar, bis das Blatt sie ganz verdeckt.
 *  - ganz unten: Titel und das oberste Angebot
 *  - ganz oben: nur die Liste; der Knopf „Karte“ holt die Karte zurück
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
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
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
import { clampSheetTop, isSheetAtTop, sheetBounds } from '@/features/map/sheet-logic';
import { groupByPlace, placeKeyOf } from '@/features/offers/feed-logic';
import { useSectionOffers } from '@/features/offers/use-section-offers';
import { errorMessage, isOffline } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, layout, radii, shadow, space } from '@/theme';

type MapWebView = WebView<object>;

/** Ruhige Feder ohne Nachschwingen, wie bei System-Sheets. */
const SHEET_SPRING = { damping: 32, stiffness: 320, mass: 1 } as const;
/** Schätzwert, bis der Kopf gemessen ist. */
const DEFAULT_HEAD = 96;
/** Höhe der Trennlinie zwischen zwei Angeboten (Linie plus Rand oben und unten). */
const SEPARATOR_HEIGHT = space[2];
/** Weiter als so viele Punkte über den Listenanfang gezogen: Blatt wieder auf Startgröße. */
const PULL_DOWN_TO_SHRINK = 56;
/** Endet ein Zug so nah am oberen Rand, rastet das Blatt ganz oben ein (Liste voll). */
const TOP_MAGNET = 72;
/** Zeit, mit der der Schwung in die Endposition hochgerechnet wird. */
const FLING_PROJECTION_S = 0.18;

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
  // Liegt das Blatt ganz oben? Dann scrollt die Liste und der Knopf „Karte“ erscheint.
  const [atTop, setAtTop] = useState(false);
  const [headHeight, setHeadHeight] = useState(DEFAULT_HEAD);
  // Wurde schon gezogen? Vorher folgt das Blatt der gemessenen Startlage.
  const [touched, setTouched] = useState(false);

  const {
    min: minTop,
    start: startTop,
    max: maxTop,
  } = sheetBounds({
    screenHeight: height,
    topInset: insets.top,
    bottomInset: insets.bottom,
    headHeight,
    separatorHeight: SEPARATOR_HEIGHT,
  });

  // Obere Kante des Blatts in Punkten vom Bildschirmrand.
  const sheetTop = useSharedValue(startTop);
  const dragStart = useSharedValue(0);

  const places = groupByPlace(offers);
  const placesScript = setPlacesScript(places);
  // Ausschnitt für die Startlage: Nadeln zwischen Zurück-Knopf und Blatt.
  const fitScript = fitPlacesScript(places, {
    top: insets.top + space[16],
    bottom: height - startTop + space[4],
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

  // Grenzen ändern sich, wenn Kopf oder Zeile gemessen sind: Blatt in den Grenzen halten.
  useEffect(() => {
    if (sheetTop.get() > maxTop) sheetTop.set(maxTop);
    else if (!touched) sheetTop.set(startTop);
    // Nur bei neuen Maßen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTop, maxTop, touched]);

  // Aus dem Gesten-Worklet: merken, ob das Blatt jetzt ganz oben liegt.
  const markAtTop = (top: boolean) => {
    setTouched(true);
    if (top && !atTop) void Haptics.selectionAsync();
    setAtTop(top);
  };

  // Blatt animiert an eine Stelle bewegen (Knopf „Karte“, Tipp auf den Griff).
  const moveTo = (target: number) => {
    setTouched(true);
    sheetTop.set(reduceMotion ? withTiming(target) : withSpring(target, SHEET_SPRING));
    setAtTop(isSheetAtTop(target, minTop));
  };

  // Verlässt das Blatt die oberste Lage, beginnt die Liste wieder oben (oberstes Angebot sichtbar).
  useEffect(() => {
    if (!atTop) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [atTop]);

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
      sheetTop.set(clampSheetTop(dragStart.get() + event.translationY, minTop, maxTop));
    },
    onDeactivate: (event: { velocityY: number }) => {
      'worklet';
      const top = sheetTop.get();
      const projected = top + event.velocityY * FLING_PROJECTION_S;
      // Nah am oberen Rand oder kräftig nach oben gewischt: ganz oben einrasten.
      if (projected <= minTop + TOP_MAGNET) {
        sheetTop.set(
          reduceMotion
            ? withTiming(minTop)
            : withSpring(minTop, { ...SHEET_SPRING, velocity: event.velocityY }),
        );
        scheduleOnRN(markAtTop, true);
        return;
      }
      // Über den unteren Rand gezogen: zurück an die unterste Lage.
      if (top >= maxTop) {
        sheetTop.set(reduceMotion ? withTiming(maxTop) : withSpring(maxTop, SHEET_SPRING));
        scheduleOnRN(markAtTop, false);
        return;
      }
      // Sonst bleibt das Blatt liegen, wo man es loslässt, mit etwas Schwung.
      if (!reduceMotion) {
        sheetTop.set(
          withDecay({ velocity: event.velocityY, clamp: [minTop + TOP_MAGNET, maxTop] }),
        );
      }
      scheduleOnRN(markAtTop, false);
    },
  });
  // Griff und Titel ziehen immer; die Liste zieht das Blatt nur, solange es nicht ganz oben
  // liegt (dort scrollt sie stattdessen).
  const handlePan = usePanGesture(panConfig(true));
  const listPan = usePanGesture(panConfig(!atTop));

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTop.get() }] }));

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
          bottom: height - sheetTop.get(),
        }),
      );
      // Das passende Angebot ganz nach oben holen, auch wenn das Blatt ganz unten liegt.
      const index = offers.findIndex((offer) => placeKeyOf(offer) === message.key);
      if (index >= 0) list.current?.scrollToIndex({ index, animated: true, viewOffset: 0 });
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onHeadLayout = (event: LayoutChangeEvent) =>
    setHeadHeight(Math.round(event.nativeEvent.layout.height));

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

      {/* Das Blatt reicht nie höher als unter den Zurück-Knopf; so passt die Höhe genau. */}
      <Animated.View style={[styles.sheet, { height: height - minTop }, sheetStyle]}>
        <GestureDetector gesture={handlePan}>
          <View onLayout={onHeadLayout}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={atTop ? m.showMapAria : m.expandAria}
              onPress={() => moveTo(atTop ? startTop : minTop)}
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
            renderItem={({ item }) => (
              <OfferListRow
                offer={item}
                highlighted={selectedKey !== null && placeKeyOf(item) === selectedKey}
              />
            )}
            ListEmptyComponent={empty}
            ItemSeparatorComponent={Separator}
            onScrollToIndexFailed={({ averageItemLength, index }) =>
              list.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })
            }
            scrollEnabled={atTop}
            onScrollEndDrag={(event) => {
              // Ganz oben und über den Listenanfang hinaus nach unten gezogen: Karte wieder zeigen.
              if (atTop && event.nativeEvent.contentOffset.y < -PULL_DOWN_TO_SHRINK) {
                moveTo(startTop);
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

      {hasOffers && atTop ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={m.showMapAria}
          onPress={() => moveTo(startTop)}
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
