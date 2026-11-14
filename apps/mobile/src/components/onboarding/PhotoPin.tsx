import { Pointer } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CATEGORY_ICONS } from '@/components/offers/category-icons';
import { OfferImage } from '@/components/offers/OfferImage';
import { PressableScale } from '@/components/ui';
import type { FeedOffer } from '@/features/offers/types';
import {
  cameraAt,
  clamp01,
  lerp,
  PIN_HEIGHT,
  PIN_SELECTED_SCALE,
  PIN_SIZE,
  project,
  type StageGeometry,
} from '@/features/onboarding/stage-math';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { colors, radii, shadow, soft } from '@/theme';

export interface CameraValues {
  progress: SharedValue<number>;
  /** 0 = noch nichts gewählt, 1 = ein Pin ist gewählt. */
  selected: SharedValue<number>;
  /** Fokus der Kamera, 0 bis 1 in Breite und Höhe. */
  focusU: SharedValue<number>;
  focusV: SharedValue<number>;
}

interface PhotoPinProps {
  offer: FeedOffer;
  index: number;
  /** Lage der Pin-Spitze auf der Karte in px. */
  worldX: number;
  worldY: number;
  isSelected: boolean;
  interactive: boolean;
  camera: CameraValues;
  geometry: StageGeometry;
  reduceMotion: boolean;
  onPress: (offer: FeedOffer) => void;
}

/**
 * Pin mit Foto des Angebots. Fällt beim Start auf die Karte, wächst beim Antippen leicht,
 * färbt sich gold und sendet einen Ring aus. Folgt der Kamera, bleibt dabei aber gleich groß.
 */
export function PhotoPin({
  offer,
  index,
  worldX,
  worldY,
  isSelected,
  interactive,
  camera,
  geometry,
  reduceMotion,
  onPress,
}: PhotoPinProps) {
  const { t } = useT();
  const CategoryIcon = CATEGORY_ICONS[offer.category];
  const drop = useSharedValue(reduceMotion ? 1 : 0);
  const active = useSharedValue(isSelected ? 1 : 0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drop.set(withDelay(180 + index * 110, withSpring(1, { damping: 11, stiffness: 170 })));
    return () => cancelAnimation(drop);
  }, [drop, index, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      active.set(isSelected ? 1 : 0);
      return;
    }
    // Ruhig, ohne Nachfedern: der Pin wächst kurz und sendet einen einzigen Ring aus.
    active.set(withTiming(isSelected ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) }));
    if (!isSelected) return;
    pulse.set(0);
    pulse.set(withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }));
    return () => cancelAnimation(pulse);
  }, [active, isSelected, pulse, reduceMotion]);

  const positionStyle = useAnimatedStyle(() => {
    const progress = camera.progress.get();
    const cam = cameraAt(
      progress,
      camera.focusU.get() * geometry.width,
      camera.focusV.get() * geometry.height,
      geometry,
    );
    const point = project(worldX, worldY, cam);
    const dropped = drop.get();
    const fade = isSelected
      ? 1 - clamp01((progress - 1.15) * 3)
      : (1 - 0.5 * camera.selected.get() * (1 - active.get())) * (1 - clamp01(progress * 2.5));
    return {
      opacity: clamp01(dropped * 2) * fade,
      transform: [
        { translateX: point.x - PIN_SIZE / 2 },
        { translateY: point.y - PIN_HEIGHT - (1 - dropped) * 46 },
      ],
    };
  });

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: lerp(0.5, 1, drop.get()) * (1 + (PIN_SELECTED_SCALE - 1) * active.get()) },
    ],
  }));

  const frameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      active.get(),
      [0, 1],
      [colors.surface.raised, colors.accent.solid],
    ),
  }));
  const tailStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      active.get(),
      [0, 1],
      [colors.surface.raised, colors.accent.solid],
    ),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.get() > 0 ? (1 - pulse.get()) * 0.6 : 0,
    transform: [{ scale: 1 + pulse.get() * 1.1 }],
  }));

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.pin, isSelected && styles.pinSelected, positionStyle]}
    >
      <Animated.View style={[styles.pinScale, scaleStyle]}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.View style={[styles.tail, tailStyle]} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t.parts.onboarding.pinLabel(offer.company_name, offer.title)}
          accessibilityHint={t.parts.onboarding.selectCompany}
          accessibilityState={{ selected: isSelected }}
          pressedScale={0.9}
          hitSlop={6}
          onPress={() => {
            haptics.tap();
            onPress(offer);
          }}
          style={styles.pressable}
        >
          <Animated.View style={[styles.photoFrame, frameStyle]}>
            {/* Symbol liegt unter dem Foto: sichtbar, solange es lädt oder fehlt. */}
            <View style={styles.photoFallback}>
              <CategoryIcon size={20} color={colors.accent.onSubtle} strokeWidth={2.2} />
            </View>
            {offer.cover_image_path ? (
              <OfferImage path={offer.cover_image_path} priority="high" style={styles.photo} />
            ) : null}
          </Animated.View>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Die Hand zeigt beim ersten Öffnen, wie es geht: Sie fährt zum Pin und tippt ihn an.
 * Der Tipp öffnet den Pin wirklich (`onTap`), danach verschwindet die Hand.
 */
export function CoachHand({
  targetX,
  targetY,
  visible,
  onTap,
}: {
  targetX: number;
  targetY: number;
  visible: boolean;
  onTap: () => void;
}) {
  const cycle = useSharedValue(0);

  useAnimatedReaction(
    () => cycle.get() >= 2,
    (pressed, previous) => {
      if (pressed && previous === false) scheduleOnRN(onTap);
    },
  );

  useEffect(() => {
    if (!visible) {
      cancelAnimation(cycle);
      // Nach dem Tipp sanft ausblenden; vorher sofort weg, damit kein zweiter Tipp entsteht.
      cycle.set(cycle.get() >= 2 ? withTiming(4, { duration: 180 }) : 0);
      return;
    }
    cycle.set(0);
    cycle.set(
      withDelay(
        1500,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
            withTiming(2, { duration: 150 }),
            withTiming(3, { duration: 220 }),
            withTiming(4, { duration: 420 }),
            withDelay(1100, withTiming(0, { duration: 0 })),
          ),
          -1,
          false,
        ),
      ),
    );
    return () => cancelAnimation(cycle);
  }, [cycle, visible]);

  // Fingerspitze des Icons (40 px) liegt etwa bei (16, 3).
  const tipX = targetX - 16;
  const tipY = targetY - PIN_HEIGHT + PIN_SIZE / 2 - 3;

  const handStyle = useAnimatedStyle(() => {
    const c = cycle.get();
    const travel = clamp01(c);
    return {
      opacity: interpolate(c, [0, 0.35, 3, 4], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: lerp(tipX + 64, tipX + 6, travel) },
        { translateY: lerp(tipY + 84, tipY + 10, travel) },
        { scale: interpolate(c, [1, 2, 3], [1, 0.84, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  const tapStyle = useAnimatedStyle(() => {
    const c = cycle.get();
    return {
      opacity: interpolate(c, [1.9, 2.1, 4], [0, 0.7, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: targetX - PIN_SIZE / 2 },
        { translateY: targetY - PIN_HEIGHT },
        { scale: interpolate(c, [2, 4], [0.9, 2.1], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} collapsable={false}>
      <Animated.View style={[styles.tapRing, tapStyle]} />
      <Animated.View style={[styles.hand, handStyle]}>
        <Pointer
          size={40}
          color={colors.text.primary}
          fill={colors.surface.raised}
          strokeWidth={1.5}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PIN_SIZE,
    height: PIN_HEIGHT,
    zIndex: 1,
  },
  pinSelected: { zIndex: 2 },
  pinScale: { width: PIN_SIZE, height: PIN_HEIGHT, transformOrigin: '50% 100%' },
  pressable: { width: PIN_SIZE, height: PIN_SIZE },
  photoFrame: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radii.full,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.badge,
  },
  photo: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  photoFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: soft.tint,
  },
  tail: {
    position: 'absolute',
    left: PIN_SIZE / 2 - 7,
    top: PIN_SIZE - 10,
    width: 14,
    height: 14,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.accent.solid,
  },
  tapRing: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.accent.strong,
  },
  hand: { position: 'absolute', left: 0, top: 0 },
});
