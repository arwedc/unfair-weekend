import { STORAGE_BUCKETS, storageImageUrl } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button, PressableScale, Text } from '@/components/ui';
import { offersInCity } from '@/features/offers/cities';
import { useOfferFilters } from '@/features/offers/filters-context';
import { useOffer, useOffers } from '@/features/offers/queries';
import type { FeedOffer } from '@/features/offers/types';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { nearestTurn, pinOffers, wheelOffers } from '@/features/onboarding/onboarding-logic';
import { clamp01, lerp } from '@/features/onboarding/stage-math';
import { env } from '@/lib/env';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, layout, radii, space, textStyle } from '@/theme';

import { OnboardingStage } from './OnboardingStage';

const STEP_COUNT = 3;
const STEP_EASING = Easing.bezier(0.2, 0, 0, 1);
/** So viele volle Umdrehungen macht der Kreis beim Erscheinen. */
const INTRO_TURNS = 3;

/** Vollbild-Onboarding: Stadtkarte mit echten Angeboten, ein Ort im Detail, drehbarer 3D-Kreis. */
export function OnboardingExperience() {
  const { finish, runId, visible } = useOnboarding();
  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
    >
      {visible ? (
        <GestureHandlerRootView style={styles.root}>
          <SafeAreaProvider style={styles.root}>
            <OnboardingFlow key={runId} onFinish={finish} />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

function OnboardingFlow({ onFinish }: { onFinish: () => void }) {
  const router = useRouter();
  const { t } = useT();
  const copy = t.parts.onboarding;
  const { width, height } = useWindowDimensions();
  const compact = height < 760;
  const reduceMotion = useReducedMotion() ?? false;
  const { cityId } = useOfferFilters();
  const { data: offers } = useOffers();
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Ablauf der ganzen Szene: 0 = Karte, 1 = Ort, 2 = Kreis (mit Zwischenwerten beim Übergang).
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);
  const heroIntro = useSharedValue(1);

  const available = offersInCity(offers ?? [], cityId).filter((offer) => offer.free_seats > 0);
  const pins = pinOffers(available);
  // Ohne eigene Wahl zeigt das Onboarding ab Schritt 2 das erste Angebot, auch wenn es erst
  // nach dem Weitertippen geladen wurde.
  const selected =
    pins.find((offer) => offer.id === selectedId) ?? (step > 0 ? pins[0] : undefined);
  const wheel = wheelOffers(selected, available);
  const { data: detail } = useOffer(selected?.id ?? '', { enabled: Boolean(selected) });
  const description = detail?.description.trim() ?? '';

  // Fotos vorladen, damit Pins und Kreis sofort Bilder zeigen.
  const imageKey = available
    .slice(0, 12)
    .map((offer) => offer.cover_image_path)
    .filter((path): path is string => Boolean(path))
    .join('|');
  useEffect(() => {
    if (!imageKey) return;
    const urls = imageKey
      .split('|')
      .map((path) => storageImageUrl(env.supabaseUrl, STORAGE_BUCKETS.offerImages, path));
    void Image.prefetch(urls).catch(() => undefined);
  }, [imageKey]);

  const selectPin = (offer: FeedOffer) => {
    if (step === 0) setSelectedId(offer.id);
  };

  const goTo = (next: number) => {
    if (next === step || next < 0 || next >= STEP_COUNT) return;
    const forward = next > step;
    if (next > 0 && !selectedId && pins[0]) setSelectedId(pins[0].id);
    setStep(next);
    void Haptics.selectionAsync();

    if (reduceMotion) {
      progress.set(next);
      heroIntro.set(1);
      rotation.set(nearestTurn(rotation.get()));
      return;
    }

    progress.set(
      withTiming(next, {
        duration: forward ? (next === 2 ? 950 : 900) : 650,
        easing: STEP_EASING,
      }),
    );
    if (next === 1) {
      // Sticker und Preis-Strich kommen, sobald das Angebot groß ist.
      heroIntro.set(0);
      heroIntro.set(withDelay(forward ? 620 : 260, withSpring(1, { damping: 9, stiffness: 130 })));
      if (!forward) rotation.set(withTiming(nearestTurn(rotation.get()), { duration: 550 }));
    }
    if (next === 2) {
      // Das Angebot wird zur vorderen Karte, dann wirbelt der Kreis los und läuft aus.
      const base = nearestTurn(rotation.get());
      rotation.set(base);
      rotation.set(
        withDelay(
          340,
          withTiming(base - 360 * INTRO_TURNS, {
            duration: 3000,
            easing: Easing.out(Easing.cubic),
          }),
        ),
      );
    }
  };

  const startExploring = () => {
    onFinish();
    router.navigate('/');
  };

  const isLast = step === STEP_COUNT - 1;
  const stepCopy = copy.steps[step];
  const title = step === 2 && wheel.length > 0 ? copy.wheelTitle(wheel.length) : stepCopy?.title;
  const barWidth = { maxWidth: Math.min(width - space[8], 680) };

  return (
    <View style={styles.fullScreen}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={[styles.topBar, barWidth]}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Sparkles size={17} color={colors.accent.onSolid} strokeWidth={2.1} />
            </View>
            <Text variant="subhead" style={styles.brandName}>
              unfair weekend
            </Text>
          </View>
          <View
            style={styles.progress}
            accessible
            accessibilityLabel={copy.stepOf(step + 1, STEP_COUNT)}
          >
            {Array.from({ length: STEP_COUNT }, (_, index) => (
              <ProgressPill key={index} index={index} progress={progress} />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <OnboardingStage
            step={step}
            pins={pins}
            wheel={wheel}
            selectedId={selected?.id ?? null}
            description={description}
            reduceMotion={reduceMotion}
            progress={progress}
            rotation={rotation}
            heroIntro={heroIntro}
            onSelect={selectPin}
          />

          <View style={styles.copy}>
            <Animated.View
              key={'title-' + step}
              entering={
                reduceMotion
                  ? undefined
                  : FadeInDown.duration(380).springify().reduceMotion(ReduceMotion.System)
              }
            >
              <Text
                variant={compact ? 'title2' : 'title1'}
                style={styles.title}
                accessibilityRole="header"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {title}
              </Text>
            </Animated.View>
            <Animated.View
              key={'body-' + step}
              entering={
                reduceMotion
                  ? undefined
                  : FadeInDown.delay(90).duration(380).reduceMotion(ReduceMotion.System)
              }
            >
              <Text variant="body" color="secondary" numberOfLines={2} style={styles.body}>
                {stepCopy?.body}
              </Text>
            </Animated.View>
          </View>

          <View style={[styles.footer, barWidth]}>
            <Button
              label={isLast ? copy.start : copy.next}
              icon={isLast ? Sparkles : ArrowRight}
              size="lg"
              fullWidth
              haptic
              onPress={() => (isLast ? startExploring() : goTo(step + 1))}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={copy.previous}
              accessibilityState={{ disabled: step === 0 }}
              disabled={step === 0}
              onPress={() => goTo(step - 1)}
              style={[styles.backButton, step === 0 && styles.backHidden]}
            >
              <ArrowLeft size={16} color={colors.text.secondary} />
              <Text variant="footnote" color="secondary">
                {t.common.back}
              </Text>
            </PressableScale>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Fortschritt oben rechts: der erreichte Schritt wird breit und gold. */
function ProgressPill({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const reached = clamp01(progress.get() - index + 1);
    return {
      width: lerp(space[3], space[6], reached),
      backgroundColor: interpolateColor(
        reached,
        [0, 1],
        [colors.border.default, colors.accent.solid],
      ),
    };
  });
  return <Animated.View style={[styles.progressTrack, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fullScreen: { flex: 1, backgroundColor: colors.background.default },
  safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: layout.screenPaddingX },
  topBar: {
    width: '100%',
    minHeight: layout.minTouchTarget + space[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  brandMark: {
    width: space[8],
    height: space[8],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.solid,
  },
  brandName: { fontFamily: fonts.semibold },
  progress: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  progressTrack: { height: space[1], borderRadius: radii.full },
  content: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  copy: { gap: space[1], paddingTop: space[4], paddingBottom: space[4] },
  title: { fontFamily: fonts.bold },
  // Zwei Zeilen fest reserviert, damit die Bühne beim Schrittwechsel gleich groß bleibt.
  body: { maxWidth: 520, minHeight: (textStyle('body').lineHeight ?? space[6]) * 2 },
  footer: { width: '100%', alignSelf: 'center', alignItems: 'center', gap: space[1] },
  backButton: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingHorizontal: space[4],
  },
  backHidden: { opacity: 0 },
});
