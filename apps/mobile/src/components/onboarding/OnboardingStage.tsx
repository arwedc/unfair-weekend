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
  Easing,
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
  snapRotation,
  stepAngle,
} from '@/features/onboarding/onboarding-logic';
import {
  bubbleCenter,
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
  reduceMotion: boolean;
  /** false, während das Onboarding sich schließt: dann reagiert nichts mehr auf Tippen. */
  interactive: boolean;
  progress: SharedValue<number>;
  rotation: SharedValue<number>;
  heroIntro: SharedValue<number>;
  onSelect: (offer: FeedOffer) => void;
  /** Tipp auf die Vorschau im Schritt 1: weiter zum großen Angebot. */
  onOpen: () => void;
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
  reduceMotion,
  interactive,
  progress,
  rotation,
  heroIntro,
  onSelect,
  onOpen,
  width,
  height,
}: OnboardingStageProps & { width: number; height: number }) {
  const { t } = useT();
  const cardWidth = Math.min(MAX_CARD_WIDTH, width - space[8]);
  const imageHeight = Math.round(cardWidth * 0.56);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const geometry = stageGeometry({
    width,
    height,
    cardWidth,
    cardHeight: cardHeight ?? imageHeight + CARD_INFO_ESTIMATE,
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
  const middleWorld = world.reduce<{ x: number; y: number; distance: number } | undefined>(
    (middle, point) => {
      const dx = point.x - width / 2;
      const dy = point.y - height / 2;
      const distance = dx * dx + dy * dy;
      return !middle || distance < middle.distance ? { ...point, distance } : middle;
    },
    undefined,
  );
  const guideTarget = selectedWorld
    ? bubbleCenter(selectedWorld.x, selectedWorld.y, geometry)
    : middleWorld
      ? { x: middleWorld.x, y: middleWorld.y - PIN_HEIGHT + PIN_SIZE / 2 }
      : undefined;

  const selected = useSharedValue(0);
  const pop = useSharedValue(0);
  const coachTap = useSharedValue(0);
  const focusU = useSharedValue(0.5);
  const focusV = useSharedValue(0.5);
  const camera: CameraValues = { progress, selected, focusU, focusV };
  const values: StageValues = { ...camera, rotation, pop, heroIntro, coachTap };

  // Neue Auswahl. Beim ersten Mal springt die Vorschau aus dem Pin. Danach gleitet sie
  // ruhig zum neuen Pin, die Karte selbst bleibt stehen.
  const focusX = selectedPoint?.x;
  const focusY = selectedPoint?.y;
  useEffect(() => {
    if (!selectedId || focusX === undefined || focusY === undefined) return;
    const first = pop.get() < 0.5;
    if (reduceMotion || first) {
      focusU.set(focusX);
      focusV.set(focusY);
    } else {
      const glide = { duration: 380, easing: Easing.out(Easing.cubic) };
      focusU.set(withTiming(focusX, glide));
      focusV.set(withTiming(focusY, glide));
    }
    if (reduceMotion) {
      selected.set(1);
      pop.set(1);
      return;
    }
    selected.set(withTiming(1, { duration: 300 }));
    if (first) pop.set(withSpring(1, { damping: 18, stiffness: 240 }));
  }, [focusU, focusV, focusX, focusY, pop, reduceMotion, selected, selectedId]);

  const count = wheel.length;
  const wheelActive = interactive && step === 2 && count > 1;
  const [front, setFront] = useState(0);
  const manualSpin = useSharedValue(false);
  // haptics drosselt selbst, schnelles Drehen verschmilzt also nicht zu einem Brummen.
  const tick = haptics.selection;

  // Haptik nur für echte Wischbewegungen, nicht während sich der Kreis selbst dreht.
  useAnimatedReaction(
    () =>
      manualSpin.get() && progress.get() > 1.4 && count > 1
        ? Math.round(rotation.get() / stepAngle(count))
        : null,
    (current, previous) => {
      if (current === null || previous === null || previous === undefined) return;
      if (current === previous) return;
      // Kein React-Render pro Kartenwechsel während der Einführung, das hält den Spin flüssig.
      scheduleOnRN(tick);
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
      manualSpin.set(true);
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
      manualSpin.set(false);
      rotation.set(reduceMotion ? target : withSpring(target, { ...SNAP_SPRING, velocity }));
      scheduleOnRN(setFront, frontIndex(target, count));
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
      scheduleOnRN(tick);
      scheduleOnRN(setFront, frontIndex(target, count));
    },
  });
  const wheelGesture = useCompetingGestures(pan, tap);

  const turnBy = (direction: 1 | -1) => {
    const target = snapRotation(rotation.get(), count) + direction * stepAngle(count);
    rotation.set(reduceMotion ? target : withSpring(target, SNAP_SPRING));
    tick();
    setFront(frontIndex(target, count));
  };

  const mapLayerStyle = useAnimatedStyle(() => ({
    opacity: lerp(1, 0.5, clamp01(progress.get())) * (1 - clamp01((progress.get() - 1) * 1.6)),
  }));
  const worldStyle = useAnimatedStyle(() => {
    const cam = cameraAt(progress.get(), focusU.get() * width, focusV.get() * height, geometry);
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

      {/* Ebenen fest getrennt (collapsable={false}): Pins liegen immer unter dem Angebot,
          die Hand immer ganz oben. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" collapsable={false}>
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
              interactive={interactive && step === 0}
              camera={camera}
              geometry={geometry}
              reduceMotion={reduceMotion}
              onPress={onSelect}
            />
          );
        })}
      </View>

      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
        collapsable={false}
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
            onMeasure={
              index === 0
                ? (measured) => {
                    if (cardHeight === null || Math.abs(measured - cardHeight) > 0.5) {
                      setCardHeight(measured);
                    }
                  }
                : undefined
            }
            onOpen={index === 0 && interactive && step === 0 ? onOpen : undefined}
          />
        ))}
      </View>

      {guideTarget && !reduceMotion ? (
        <CoachHand
          key={selectedId ?? 'pin'}
          cycle={coachTap}
          targetX={guideTarget.x}
          targetY={guideTarget.y}
          visible={step === 0}
          showTapRing={!selectedId}
        />
      ) : null}

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
