import { MapPin, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import {
  GestureDetector,
  useCompetingGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui';
import type { FeedOffer } from '@/features/offers/types';
import {
  frontIndex,
  layoutPins,
  normalizeAngle,
  snapRotation,
  stepAngle,
} from '@/features/onboarding/onboarding-logic';
import {
  cameraAt,
  clamp01,
  lerp,
  mapTransform,
  PIN_HEIGHT,
  PIN_SIZE,
  stageGeometry,
  type StageGeometry,
} from '@/features/onboarding/stage-math';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { colors, radii, soft, space } from '@/theme';

import { CityMapArt } from './CityMapArt';
import { CoachHand, PhotoPin, type CameraValues } from './PhotoPin';
import { StageCard, type StageValues } from './StageCard';

const MAX_CARD_WIDTH = 280;
/** Grobe Kartenhöhe, bis die echte gemessen ist. */
const CARD_INFO_ESTIMATE = 128;
/** Ein Wisch über die ganze Bühne dreht den Kreis um so viele Grad. */
const SWIPE_DEGREES = 210;
const SNAP_SPRING = { damping: 22, stiffness: 95, mass: 1 } as const;

interface OnboardingStageProps {
  step: number;
  pins: readonly FeedOffer[];
  /** Karten im Kreis, das gewählte Angebot zuerst. */
  wheel: readonly FeedOffer[];
  selectedId: string | null;
  description: string;
  reduceMotion: boolean;
  progress: SharedValue<number>;
  rotation: SharedValue<number>;
  heroIntro: SharedValue<number>;
  onSelect: (offer: FeedOffer) => void;
}

/**
 * Bühne des Onboardings. Eine durchgehende Szene statt drei Bildern: Die Kamera fliegt
 * über die Stadtkarte zum gewählten Ort, das Angebot wächst aus dem Pin und wird
 * schließlich zur vorderen Karte im drehbaren 3D-Kreis.
 */
export function OnboardingStage(props: OnboardingStageProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={styles.stage}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ width, height });
      }}
    >
      {size ? <Scene {...props} width={size.width} height={size.height} /> : null}
    </View>
  );
}

function Scene({
  step,
  pins,
  wheel,
  selectedId,
  description,
  reduceMotion,
  progress,
  rotation,
  heroIntro,
  onSelect,
  width,
  height,
}: OnboardingStageProps & { width: number; height: number }) {
  const { t } = useT();
  const cardWidth = Math.min(MAX_CARD_WIDTH, width - space[8]);
  const imageHeight = Math.round(cardWidth * 0.56);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const [noteHeight, setNoteHeight] = useState(0);
  const geometry = stageGeometry({
    width,
    height,
    cardWidth,
    cardHeight: cardHeight ?? imageHeight + CARD_INFO_ESTIMATE,
    noteHeight: description ? noteHeight : 0,
  });

  const points = layoutPins(
    pins.map((offer) => ({ lat: offer.lat, lng: offer.lng })),
    {
      aspect: width / height,
      padTop: (PIN_HEIGHT + space[3]) / height,
      padBottom: space[5] / height,
      padX: (PIN_SIZE / 2 + space[3]) / width,
      minDistance: (PIN_SIZE + space[3]) / height,
    },
  );
  const world = points.map((point) => ({ x: point.x * width, y: point.y * height }));
  const selectedIndex = pins.findIndex((offer) => offer.id === selectedId);
  const selectedPoint = selectedIndex >= 0 ? points[selectedIndex] : undefined;
  const selectedWorld = selectedIndex >= 0 ? world[selectedIndex] : undefined;

  const selected = useSharedValue(0);
  const pop = useSharedValue(0);
  const focusU = useSharedValue(0.5);
  const focusV = useSharedValue(0.5);
  const camera: CameraValues = { progress, selected, focusU, focusV };
  const values: StageValues = { ...camera, rotation, pop, heroIntro };

  // Neue Auswahl: Vorschau springt aus dem Pin.
  useEffect(() => {
    if (!selectedId) return;
    if (reduceMotion) {
      selected.set(1);
      pop.set(1);
      return;
    }
    selected.set(withTiming(1, { duration: 520 }));
    pop.set(0);
    pop.set(withSpring(1, { damping: 12, stiffness: 190 }));
  }, [pop, reduceMotion, selected, selectedId]);

  // Kamera schwenkt zum gewählten Ort.
  const focusX = selectedPoint?.x;
  const focusY = selectedPoint?.y;
  useEffect(() => {
    if (focusX === undefined || focusY === undefined) return;
    if (reduceMotion) {
      focusU.set(focusX);
      focusV.set(focusY);
      return;
    }
    focusU.set(withSpring(focusX, { damping: 20, stiffness: 120 }));
    focusV.set(withSpring(focusY, { damping: 20, stiffness: 120 }));
  }, [focusU, focusV, focusX, focusY, reduceMotion]);

  const count = wheel.length;
  const wheelActive = step === 2 && count > 1;
  const [front, setFront] = useState(0);
  // haptics drosselt selbst, schnelles Drehen verschmilzt also nicht zu einem Brummen.
  const tick = haptics.selection;

  // Klickt wie ein Glücksrad, sobald eine Karte vorne vorbeizieht.
  useAnimatedReaction(
    () =>
      progress.get() > 1.4 && count > 1 ? Math.round(rotation.get() / stepAngle(count)) : null,
    (current, previous) => {
      if (current === null || previous === null || previous === undefined) return;
      if (current === previous) return;
      scheduleOnRN(tick);
      scheduleOnRN(setFront, frontIndex(rotation.get(), count));
    },
  );

  const dragOrigin = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const degreesPerPx = SWIPE_DEGREES / width;

  const pan = usePanGesture({
    enabled: wheelActive,
    activeOffsetX: [-8, 8],
    failOffsetY: [-24, 24],
    onActivate: (event) => {
      'worklet';
      cancelAnimation(rotation);
      dragOrigin.set(rotation.get());
      dragStart.set(event.translationX);
    },
    onUpdate: (event) => {
      'worklet';
      rotation.set(dragOrigin.get() + (event.translationX - dragStart.get()) * degreesPerPx);
    },
    onDeactivate: (event) => {
      'worklet';
      const velocity = event.velocityX * degreesPerPx;
      const target = snapRotation(rotation.get(), count, velocity, 0.28, 900);
      rotation.set(reduceMotion ? target : withSpring(target, { ...SNAP_SPRING, velocity }));
    },
  });

  const tap = useTapGesture({
    enabled: wheelActive,
    onActivate: (event) => {
      'worklet';
      // Tipp links holt die linke Karte nach vorne, Tipp rechts die rechte.
      const direction = event.x < width * 0.38 ? 1 : event.x > width * 0.62 ? -1 : 0;
      if (direction === 0) return;
      const target = snapRotation(rotation.get(), count) + direction * stepAngle(count);
      rotation.set(reduceMotion ? target : withSpring(target, SNAP_SPRING));
    },
  });
  const wheelGesture = useCompetingGestures(pan, tap);

  const turnBy = (direction: 1 | -1) => {
    const target = snapRotation(rotation.get(), count) + direction * stepAngle(count);
    rotation.set(reduceMotion ? target : withSpring(target, SNAP_SPRING));
    setFront(frontIndex(target, count));
  };

  const mapLayerStyle = useAnimatedStyle(() => ({
    opacity: lerp(1, 0.5, clamp01(progress.get())) * (1 - clamp01((progress.get() - 1) * 1.6)),
  }));
  const worldStyle = useAnimatedStyle(() => {
    const cam = cameraAt(
      progress.get(),
      selected.get(),
      focusU.get() * width,
      focusV.get() * height,
      geometry,
    );
    const { translateX, translateY, scale } = mapTransform(cam, geometry);
    return { transform: [{ translateX }, { translateY }, { scale }] };
  });

  const frontOffer = wheel[front] ?? wheel[0];
  const leadOffer = wheel[0];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.mapLayer, mapLayerStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[StyleSheet.absoluteFill, worldStyle]}>
          <CityMapArt />
        </Animated.View>
      </Animated.View>

      {count > 0 ? <Backdrop geometry={geometry} progress={progress} /> : null}

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {pins.map((offer, index) => {
          const point = world[index];
          if (!point) return null;
          return (
            <PhotoPin
              key={offer.id}
              offer={offer}
              index={index}
              worldX={point.x}
              worldY={point.y}
              isSelected={offer.id === selectedId}
              interactive={step === 0}
              camera={camera}
              geometry={geometry}
              reduceMotion={reduceMotion}
              onPress={onSelect}
            />
          );
        })}
        {pins.length > 0 && world[0] && !reduceMotion ? (
          <CoachHand
            targetX={world[0].x}
            targetY={world[0].y}
            visible={step === 0 && !selectedId}
          />
        ) : null}
      </View>

      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessible={step === 1 && Boolean(leadOffer)}
        accessibilityLabel={
          leadOffer ? t.parts.onboarding.pinLabel(leadOffer.company_name, leadOffer.title) : ''
        }
      >
        {wheel.map((offer, index) => (
          <StageCard
            key={offer.id}
            offer={offer}
            index={index}
            count={count}
            geometry={geometry}
            values={values}
            imageHeight={imageHeight}
            pinX={index === 0 ? selectedWorld?.x : undefined}
            pinY={index === 0 ? selectedWorld?.y : undefined}
            description={index === 0 ? description : undefined}
            onMeasure={
              index === 0
                ? (measured) => {
                    if (cardHeight === null || Math.abs(measured - cardHeight) > 0.5) {
                      setCardHeight(measured);
                    }
                  }
                : undefined
            }
            onNoteMeasure={
              index === 0
                ? (measured) => {
                    if (Math.abs(measured - noteHeight) > 0.5) setNoteHeight(measured);
                  }
                : undefined
            }
          />
        ))}
      </View>

      {count > 1 ? <WheelDots count={count} rotation={rotation} progress={progress} /> : null}

      {pins.length === 0 ? <EmptyScene step={step} /> : null}

      <GestureDetector gesture={wheelGesture}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={wheelActive ? 'auto' : 'none'}
          accessible={wheelActive}
          accessibilityRole="adjustable"
          accessibilityLabel={t.parts.onboarding.carousel}
          accessibilityHint={t.parts.onboarding.carouselHint}
          accessibilityValue={
            frontOffer
              ? { text: t.parts.onboarding.wheelValue(front + 1, count, frontOffer.title) }
              : undefined
          }
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event: AccessibilityActionEvent) => {
            if (event.nativeEvent.actionName === 'increment') turnBy(-1);
            if (event.nativeEvent.actionName === 'decrement') turnBy(1);
          }}
        />
      </GestureDetector>
    </View>
  );
}

/** Flache Formen hinter den Karten: schräges Blatt im Schritt 2, Drehteller im Schritt 3. */
function Backdrop({
  geometry: g,
  progress,
}: {
  geometry: StageGeometry;
  progress: SharedValue<number>;
}) {
  const sheetStyle = useAnimatedStyle(() => {
    const visible = 1 - clamp01(Math.abs(progress.get() - 1) * 2.5);
    return {
      opacity: visible,
      transform: [
        { translateX: g.heroX - g.cardWidth / 2 + space[3] },
        { translateY: g.heroY - g.cardHeight / 2 + space[2] },
        { scale: g.heroScale * lerp(0.85, 1, visible) },
        { rotateZ: `${lerp(0, 6, visible)}deg` },
      ],
    };
  });
  // Drehteller: ein Kreis, flach gedrückt zur Ellipse.
  const floorWidth = Math.min(g.width - space[4], g.wheelRadius * 2 + g.cardWidth * g.wheelScale);
  const floorFlat = space[12] / floorWidth;
  const floorStyle = useAnimatedStyle(() => {
    const visible = clamp01((progress.get() - 1.2) * 1.6);
    return {
      opacity: visible,
      transform: [
        { translateX: g.wheelX - floorWidth / 2 },
        { translateY: g.floorY - floorWidth / 2 },
        { scaleY: floorFlat },
        { scale: lerp(0.4, 1, visible) },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.sheet, { width: g.cardWidth, height: g.cardHeight }, sheetStyle]}
      />
      <Animated.View
        style={[styles.floor, { width: floorWidth, height: floorWidth }, floorStyle]}
      />
    </View>
  );
}

/** Punkte unter dem Kreis, der vordere ist breit und gold. */
function WheelDots({
  count,
  rotation,
  progress,
}: {
  count: number;
  rotation: SharedValue<number>;
  progress: SharedValue<number>;
}) {
  const rowStyle = useAnimatedStyle(() => ({
    opacity: clamp01((progress.get() - 1.5) * 2),
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.dots, rowStyle]}>
      {Array.from({ length: count }, (_, index) => (
        <WheelDot key={index} index={index} count={count} rotation={rotation} />
      ))}
    </Animated.View>
  );
}

function WheelDot({
  index,
  count,
  rotation,
}: {
  index: number;
  count: number;
  rotation: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const angle = normalizeAngle(rotation.get() + index * stepAngle(count));
    const near = 1 - clamp01(Math.abs(angle) / stepAngle(count));
    return {
      width: lerp(space[1.5], space[5], near),
      backgroundColor: interpolateColor(near, [0, 1], [colors.border.strong, colors.accent.strong]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function EmptyScene({ step }: { step: number }) {
  const { t } = useT();
  return (
    <View pointerEvents="none" style={styles.empty}>
      {step === 0 ? (
        <MapPin size={36} color={colors.accent.strong} fill={colors.accent.solid} />
      ) : (
        <>
          <View style={styles.emptyMark}>
            <Sparkles size={32} color={colors.accent.onSubtle} />
          </View>
          <Text variant="headline" align="center">
            {step === 1 ? t.parts.onboarding.offerOnSite : t.parts.onboarding.comingSoon}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 260, overflow: 'hidden' },
  mapLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: radii['2xl'],
    backgroundColor: colors.background.muted,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radii['2xl'],
    backgroundColor: soft.tintStrong,
  },
  floor: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radii.full,
    backgroundColor: soft.tint,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space[2],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[1.5],
  },
  dot: { height: space[1.5], borderRadius: radii.full },
  empty: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[8],
  },
  emptyMark: {
    width: space[16],
    height: space[16],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: soft.tint,
  },
});
