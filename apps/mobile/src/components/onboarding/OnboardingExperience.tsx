import { formatDiscount, formatPrice } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, MapPin, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutLeft,
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

import { OfferImage } from '@/components/offers/OfferImage';
import { Button, PressableScale, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { offersInCity } from '@/features/offers/cities';
import { useOfferFilters } from '@/features/offers/filters-context';
import { offerWhenText } from '@/features/offers/feed-logic';
import { useOffer, useOffers } from '@/features/offers/queries';
import type { FeedOffer } from '@/features/offers/types';
import { useT } from '@/lib/i18n/context';
import { colors, duration, fonts, layout, radii, shadow, soft, space } from '@/theme';

const MAP_MARKER_POSITIONS = [
  { left: '50%', top: '15%', marginLeft: -24 },
  { left: '22%', top: '36%', marginLeft: -24 },
  { left: '78%', top: '36%', marginLeft: -24 },
  { left: '34%', top: '67%', marginLeft: -24 },
  { left: '66%', top: '67%', marginLeft: -24 },
] as const;

function companiesFromOffers(offers: readonly FeedOffer[]): FeedOffer[] {
  const seen = new Set<string>();
  return offers
    .filter((offer) => {
      if (seen.has(offer.company_id)) return false;
      seen.add(offer.company_id);
      return true;
    })
    .slice(0, 5);
}

function StreetMapArt() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[styles.road, styles.roadA]} />
      <View style={[styles.road, styles.roadB]} />
      <View style={[styles.road, styles.roadC]} />
      <View style={[styles.road, styles.roadD]} />
    </View>
  );
}

function CompanyMarker({
  offer,
  index,
  focused,
  onSelect,
}: {
  offer: FeedOffer;
  index: number;
  focused: boolean;
  onSelect: (offer: FeedOffer) => void;
}) {
  const { t } = useT();
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 65)
        .duration(duration.slow)
        .reduceMotion(ReduceMotion.System)}
      style={[styles.companyMarkerPosition, MAP_MARKER_POSITIONS[index]]}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={offer.company_name}
        accessibilityHint={t.parts.onboarding.selectCompany}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          void Haptics.selectionAsync();
          onSelect(offer);
        }}
        style={styles.companyMarker}
      >
        <MapPin
          size={focused ? 30 : 26}
          color={focused ? colors.accent.solid : colors.text.secondary}
          fill={focused ? colors.accent.solid : colors.background.default}
          strokeWidth={2.3}
        />
      </PressableScale>
    </Animated.View>
  );
}

function MapOverviewArtwork({
  companies,
  selectedCompanyId,
  onSelectCompany,
}: {
  companies: readonly FeedOffer[];
  selectedCompanyId?: string;
  onSelectCompany: (offer: FeedOffer) => void;
}) {
  return (
    <View style={styles.mapOverviewArtwork}>
      <View style={styles.mapOverviewFrame}>
        <StreetMapArt />
        {companies.map((offer, index) => (
          <CompanyMarker
            key={offer.company_id}
            offer={offer}
            index={index}
            focused={offer.company_id === selectedCompanyId}
            onSelect={onSelectCompany}
          />
        ))}
        {companies.length === 0 ? (
          <View style={styles.mapEmptyState}>
            <MapPin size={30} color={colors.accent.solid} fill={colors.accent.solid} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ZoomOfferCard({
  offer,
  description,
  compact,
}: {
  offer?: FeedOffer;
  description: string;
  compact: boolean;
}) {
  const { t, locale } = useT();
  if (!offer) {
    return (
      <View style={styles.zoomOfferCard}>
        <Text variant="headline">{t.parts.onboarding.offerOnSite}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.zoomOfferCard, compact && styles.zoomOfferCardCompact]}>
      {offer.cover_image_path ? (
        <OfferImage
          path={offer.cover_image_path}
          priority="high"
          style={[styles.zoomOfferImage, compact && styles.zoomOfferImageCompact]}
          accessibilityLabel={offer.title}
        />
      ) : (
        <View style={[styles.zoomOfferImage, styles.imageFallback]}>
          <Sparkles size={28} color={colors.accent.solid} />
        </View>
      )}
      <View style={styles.zoomOfferDetails}>
        <Text variant="caption" color="accent" style={styles.discountText}>
          {t.parts.onboarding.discountCaps(formatDiscount(offer.discount_percent, locale))}
        </Text>
        <Text variant="title3" numberOfLines={2}>
          {offer.title}
        </Text>
        {description ? (
          <View style={styles.whatToExpect}>
            <Text variant="caption" color="tertiary" style={styles.whatLabel}>
              WAS ERWARTET DICH
            </Text>
            <Text variant="footnote" color="secondary" numberOfLines={compact ? 1 : 2}>
              {description}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.zoomPriceRow}>
        <Text variant="headline" color="accent">
          {formatPrice(offer.deal_price_cents, { locale })}
        </Text>
        <Text variant="footnote" color="tertiary" style={styles.oldPrice}>
          {formatPrice(offer.original_price_cents, { locale })}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1} style={styles.offerWhen}>
          {offerWhenText(offer, undefined, locale)}
        </Text>
      </View>
    </View>
  );
}

function VenueZoomArtwork({
  offer,
  description,
  reduceMotion,
  compact,
}: {
  offer?: FeedOffer;
  description: string;
  reduceMotion: boolean;
  compact: boolean;
}) {
  const { t } = useT();
  const zoom = useSharedValue(reduceMotion ? 1 : 0);
  const pinPop = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      zoom.set(1);
      pinPop.set(1);
      return;
    }
    zoom.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    pinPop.set(withDelay(380, withSpring(1, { damping: 13, stiffness: 155 })));
    return () => {
      cancelAnimation(zoom);
      cancelAnimation(pinPop);
    };
  }, [pinPop, reduceMotion, zoom]);

  const mapStyle = useAnimatedStyle(() => ({
    opacity: 0.62 + zoom.get() * 0.38,
    transform: [{ scale: 0.92 + zoom.get() * 0.25 }],
  }));
  const pinStyle = useAnimatedStyle(() => ({
    opacity: pinPop.get(),
    transform: [{ scale: 0.55 + pinPop.get() * 0.45 }, { translateY: (1 - pinPop.get()) * -10 }],
  }));

  return (
    <View style={styles.zoomScene}>
      <View style={styles.zoomMapViewport}>
        <Animated.View style={[styles.zoomMapCanvas, mapStyle]}>
          <StreetMapArt />
        </Animated.View>
        <Animated.View style={[styles.zoomPin, pinStyle]}>
          <MapPin size={34} color={colors.accent.onSolid} fill={colors.accent.solid} />
        </Animated.View>
        <Animated.View
          entering={FadeIn.delay(duration.base)
            .duration(duration.slow)
            .reduceMotion(ReduceMotion.System)}
          style={styles.zoomVenueLabel}
        >
          <Text variant="caption" color="accent" style={styles.placeOverline}>
            {offer?.company_name ?? t.parts.onboarding.localProvider}
          </Text>
          {offer ? (
            <Text variant="footnote" color="secondary" numberOfLines={1}>
              {offer.location_name}
            </Text>
          ) : null}
        </Animated.View>
      </View>
      <Animated.View
        entering={FadeInUp.delay(reduceMotion ? 0 : 360)
          .duration(duration.slow)
          .reduceMotion(ReduceMotion.System)}
      >
        <ZoomOfferCard offer={offer} description={description} compact={compact} />
      </Animated.View>
    </View>
  );
}

function CarouselOfferCard({
  offer,
  index,
  count,
  rotation,
  reduceMotion,
  cardWidth,
  orbitRadius,
  compact,
}: {
  offer: FeedOffer;
  index: number;
  count: number;
  rotation: SharedValue<number>;
  reduceMotion: boolean;
  cardWidth: number;
  orbitRadius: number;
  compact: boolean;
}) {
  const { locale } = useT();
  const stepAngle = 360 / count;
  const spread = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      spread.set(1);
      return;
    }
    // The selected deal lands first; the remaining cards then fan out around it.
    const delay = index === 0 ? 0 : 460 + (index - 1) * 90;
    spread.set(withDelay(delay, withSpring(1, { damping: 19, stiffness: 95 })));
    return () => cancelAnimation(spread);
  }, [index, reduceMotion, spread]);

  const positionStyle = useAnimatedStyle(() => {
    const angle = rotation.get() + index * stepAngle;
    const radians = (angle * Math.PI) / 180;
    const depth = (Math.cos(radians) + 1) / 2;
    const progress = spread.get();

    return {
      opacity: progress * (0.28 + depth * 0.72),
      zIndex: Math.round(depth * 100),
      transform: [
        { translateX: Math.sin(radians) * orbitRadius * progress },
        { translateY: (1 - progress) * (compact ? 72 : 104) },
      ],
    };
  });
  const faceStyle = useAnimatedStyle(() => {
    const angle = rotation.get() + index * stepAngle;
    const radians = (angle * Math.PI) / 180;
    const depth = (Math.cos(radians) + 1) / 2;
    const progress = spread.get();
    const faceAngle = ((((angle * progress + 180) % 360) + 360) % 360) - 180;

    return {
      transform: [
        { perspective: 1000 },
        { rotateY: faceAngle + 'deg' },
        { scale: (0.78 + depth * 0.22) * (index === 0 ? 0.92 + progress * 0.08 : 1) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.carouselCardPosition,
        { width: cardWidth, marginLeft: -cardWidth / 2 },
        positionStyle,
      ]}
    >
      <Animated.View style={[styles.carouselCardFace, faceStyle]}>
        <View style={styles.carouselCardContent}>
          <View style={styles.carouselImage}>
            {offer.cover_image_path ? (
              <OfferImage
                path={offer.cover_image_path}
                priority="high"
                accessibilityLabel={offer.title}
              />
            ) : (
              <View style={styles.imageFallback}>
                <Sparkles size={32} color={colors.accent.solid} />
              </View>
            )}
            <View style={styles.discountBadge}>
              <Text variant="caption" style={styles.discountText}>
                {formatDiscount(offer.discount_percent, locale)}
              </Text>
            </View>
          </View>
          <View style={styles.carouselInfo}>
            <Text variant="title3" numberOfLines={2}>
              {offer.title}
            </Text>
            <Text variant="footnote" color="secondary" numberOfLines={1}>
              {offer.company_name}
            </Text>
            <View style={styles.carouselPrice}>
              <Text variant="headline" color="accent">
                {formatPrice(offer.deal_price_cents, { locale })}
              </Text>
              <Text variant="footnote" color="tertiary" style={styles.oldPrice}>
                {formatPrice(offer.original_price_cents, { locale })}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function OfferCarouselArtwork({
  offers,
  reduceMotion,
  width,
  compact,
}: {
  offers: readonly FeedOffer[];
  reduceMotion: boolean;
  width: number;
  compact: boolean;
}) {
  const { t } = useT();
  const rotation = useSharedValue(0);
  const dragOrigin = useSharedValue(0);
  const cardWidth = Math.min(width - space[16], 184);
  const orbitRadius = cardWidth * 1.06;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(offers.length > 1)
        .activeOffsetX([-8, 8])
        .onBegin(() => {
          cancelAnimation(rotation);
          dragOrigin.set(rotation.get());
        })
        .onUpdate((event) => {
          rotation.set(dragOrigin.get() + event.translationX * 0.68);
        })
        .onEnd((event) => {
          const stepAngle = 360 / offers.length;
          const nextAngle =
            Math.round((rotation.get() + event.velocityX * 0.025) / stepAngle) * stepAngle;
          if (reduceMotion) {
            rotation.set(nextAngle);
            return;
          }
          rotation.set(withSpring(nextAngle, { damping: 17, stiffness: 140 }));
        }),
    [dragOrigin, offers.length, reduceMotion, rotation],
  );

  return (
    <View style={styles.carouselScene}>
      {offers.length > 0 ? (
        <GestureDetector gesture={gesture}>
          <View
            style={styles.carouselWheel}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t.parts.onboarding.carousel}
            accessibilityHint={t.parts.onboarding.carouselHint}
          >
            {offers.map((offer, index) => (
              <CarouselOfferCard
                key={offer.id}
                offer={offer}
                index={index}
                count={offers.length}
                rotation={rotation}
                reduceMotion={reduceMotion}
                cardWidth={cardWidth}
                orbitRadius={orbitRadius}
                compact={compact}
              />
            ))}
          </View>
        </GestureDetector>
      ) : (
        <View style={styles.noOffers}>
          <Sparkles size={40} color={colors.accent.solid} />
          <Text variant="headline" align="center">
            Neue Angebote kommen bald.
          </Text>
        </View>
      )}
    </View>
  );
}

function Artwork({
  step,
  companies,
  selectedOffer,
  onSelectCompany,
  carouselOffers,
  description,
  reduceMotion,
  compact,
  width,
}: {
  step: number;
  companies: readonly FeedOffer[];
  selectedOffer?: FeedOffer;
  onSelectCompany: (offer: FeedOffer) => void;
  carouselOffers: readonly FeedOffer[];
  description: string;
  reduceMotion: boolean;
  compact: boolean;
  width: number;
}) {
  if (step === 0) {
    return (
      <MapOverviewArtwork
        companies={companies}
        selectedCompanyId={selectedOffer?.company_id}
        onSelectCompany={onSelectCompany}
      />
    );
  }
  if (step === 1) {
    return (
      <VenueZoomArtwork
        offer={selectedOffer}
        description={description}
        reduceMotion={reduceMotion}
        compact={compact}
      />
    );
  }
  return (
    <OfferCarouselArtwork
      offers={carouselOffers}
      reduceMotion={reduceMotion}
      width={width}
      compact={compact}
    />
  );
}

/** Vollbild-Onboarding: Stadtkarte, echter Standort und drehbarer Angebotskreis. */
export function OnboardingExperience() {
  const router = useRouter();
  const { t } = useT();
  const STEPS = t.parts.onboarding.steps;
  const { width, height } = useWindowDimensions();
  const compact = height < 760;
  const reduceMotion = useReducedMotion() ?? false;
  const { cityId } = useOfferFilters();
  const { data: offers } = useOffers();
  const { finish, runId, visible } = useOnboarding();
  const [slide, setSlide] = useState({ runId, step: 0 });
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const step = slide.runId === runId ? slide.step : 0;

  const availableOffers = offersInCity(offers ?? [], cityId).filter(
    (offer) => offer.free_seats > 0,
  );
  const selectedOffer =
    availableOffers.find((offer) => offer.id === selectedOfferId) ?? availableOffers[0];
  const mapCompanies = companiesFromOffers(availableOffers);
  const carouselOffers = selectedOffer
    ? [selectedOffer, ...availableOffers.filter((offer) => offer.id !== selectedOffer.id)].slice(
        0,
        5,
      )
    : [];
  const { data: offerDetail } = useOffer(selectedOffer?.id ?? '', {
    enabled: Boolean(selectedOffer),
  });
  const description = offerDetail?.description.trim() ?? '';

  const moveTo = (next: number) => {
    setSlide({ runId, step: next });
    void Haptics.selectionAsync();
  };

  const startExploring = () => {
    finish();
    router.navigate('/');
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
    >
      {visible ? (
        <GestureHandlerRootView style={styles.modalGestureRoot}>
          <SafeAreaProvider style={styles.modalSafeAreaRoot}>
            <View style={styles.fullScreen}>
              <StatusBar style="dark" />
              <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={[styles.topBar, { maxWidth: Math.min(width - space[8], 680) }]}>
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
                    accessibilityLabel={t.parts.onboarding.stepOf(step + 1, STEPS.length)}
                  >
                    {STEPS.map((item, index) => (
                      <View
                        key={item.title}
                        style={[styles.progressTrack, index <= step && styles.progressTrackActive]}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.content}>
                  <View
                    style={[
                      styles.stage,
                      step === 0 && {
                        flex: 0,
                        height: Math.min(340, Math.max(250, height * 0.42)),
                      },
                    ]}
                  >
                    <Animated.View
                      key={runId + '-' + step}
                      entering={
                        reduceMotion
                          ? undefined
                          : step === 2
                            ? FadeIn.duration(duration.base).reduceMotion(ReduceMotion.System)
                            : FadeInRight.duration(duration.slow).reduceMotion(ReduceMotion.System)
                      }
                      exiting={
                        reduceMotion
                          ? undefined
                          : step === 1
                            ? FadeOut.duration(duration.base).reduceMotion(ReduceMotion.System)
                            : FadeOutLeft.duration(duration.fast).reduceMotion(ReduceMotion.System)
                      }
                      style={styles.artwork}
                    >
                      <View
                        style={styles.artworkContent}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Artwork
                          step={step}
                          companies={mapCompanies}
                          selectedOffer={selectedOffer}
                          onSelectCompany={(offer) => setSelectedOfferId(offer.id)}
                          carouselOffers={carouselOffers}
                          description={description}
                          reduceMotion={reduceMotion}
                          compact={compact}
                          width={width}
                        />
                      </View>
                    </Animated.View>
                  </View>

                  <Animated.View
                    key={'copy-' + runId + '-' + step}
                    entering={
                      reduceMotion
                        ? undefined
                        : FadeInDown.delay(duration.fast)
                            .duration(duration.slow)
                            .reduceMotion(ReduceMotion.System)
                    }
                    style={[styles.copy, (step === 0 || step === 2) && styles.copyTight]}
                  >
                    <Text
                      variant={step === 0 ? 'title2' : 'title1'}
                      style={styles.title}
                      accessibilityRole="header"
                    >
                      {STEPS[step]?.title}
                    </Text>
                    <Text variant="body" color="secondary" style={styles.body}>
                      {STEPS[step]?.body}
                    </Text>
                  </Animated.View>

                  <View style={[styles.footer, { maxWidth: Math.min(width - space[8], 680) }]}>
                    <Button
                      label={
                        step < STEPS.length - 1 ? t.parts.onboarding.next : t.parts.onboarding.start
                      }
                      icon={step < STEPS.length - 1 ? ArrowRight : Sparkles}
                      size="lg"
                      fullWidth
                      haptic
                      onPress={() =>
                        step < STEPS.length - 1 ? moveTo(step + 1) : startExploring()
                      }
                    />
                    {step > 0 ? (
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={t.parts.onboarding.previous}
                        onPress={() => moveTo(step - 1)}
                        style={styles.backButton}
                      >
                        <ArrowLeft size={16} color={colors.text.secondary} />
                        <Text variant="footnote" color="secondary">
                          Zurück
                        </Text>
                      </PressableScale>
                    ) : null}
                  </View>
                </View>
              </SafeAreaView>
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalGestureRoot: { flex: 1 },
  modalSafeAreaRoot: { flex: 1 },
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
  progressTrack: {
    width: space[3],
    height: space[1],
    borderRadius: radii.full,
    backgroundColor: colors.border.default,
  },
  progressTrackActive: { width: space[6], backgroundColor: colors.accent.solid },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  stage: { flex: 1, minHeight: space[20], justifyContent: 'center', overflow: 'hidden' },
  artwork: { flex: 1, justifyContent: 'center' },
  artworkContent: { flex: 1, width: '100%' },
  copy: { gap: space[2], paddingBottom: space[4] },
  copyTight: { gap: space[1], paddingBottom: space[2] },
  title: { fontFamily: fonts.bold },
  body: { maxWidth: 520 },
  footer: { width: '100%', alignSelf: 'center', alignItems: 'center', gap: space[2] },
  backButton: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
  mapOverviewArtwork: { flex: 1, justifyContent: 'center' },
  mapOverviewFrame: {
    flex: 1,
    width: '100%',
    maxHeight: 420,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: radii['2xl'],
    backgroundColor: colors.background.muted,
  },
  companyMarkerPosition: {
    position: 'absolute',
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
  },
  companyMarker: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEmptyState: {
    position: 'absolute',
    top: '43%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  road: {
    position: 'absolute',
    borderRadius: radii.full,
    backgroundColor: colors.surface.raised,
  },
  roadA: {
    width: '125%',
    height: space[3],
    left: '-12%',
    top: '25%',
    transform: [{ rotate: '-18deg' }],
  },
  roadB: {
    width: '120%',
    height: space[3],
    left: '-7%',
    top: '68%',
    transform: [{ rotate: '19deg' }],
  },
  roadC: {
    width: space[3],
    height: '125%',
    left: '31%',
    top: '-12%',
    transform: [{ rotate: '22deg' }],
  },
  roadD: {
    width: space[3],
    height: '120%',
    right: '24%',
    top: '-8%',
    transform: [{ rotate: '-28deg' }],
  },
  zoomScene: { flex: 1, justifyContent: 'center', gap: space[3] },
  zoomMapViewport: {
    flex: 1,
    minHeight: 128,
    maxHeight: 228,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radii['2xl'],
    backgroundColor: colors.background.muted,
  },
  zoomMapCanvas: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  zoomPin: { position: 'absolute', top: '14%', left: '50%', marginLeft: -space[4] },
  zoomVenueLabel: {
    position: 'absolute',
    top: '43%',
    left: space[3],
    right: space[3],
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.lg,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.badge,
  },
  placeOverline: { fontFamily: fonts.bold, letterSpacing: 0.7 },
  zoomOfferCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },
  zoomOfferCardCompact: { gap: space[2], padding: space[2] },
  zoomOfferImage: { width: space[20], height: space[20], borderRadius: radii.lg },
  zoomOfferImageCompact: { width: space[16], height: space[16] },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: soft.tint },
  zoomOfferDetails: { flex: 1, minWidth: 150, gap: space[1] },
  discountText: { color: colors.accent.solid, fontFamily: fonts.bold },
  whatToExpect: { gap: space[0.5], paddingTop: space[1] },
  whatLabel: { fontFamily: fonts.bold, letterSpacing: 0.7 },
  zoomPriceRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    paddingTop: space[1],
  },
  oldPrice: { textDecorationLine: 'line-through' },
  offerWhen: { flex: 1, marginLeft: 'auto', textAlign: 'right' },
  carouselScene: {
    flex: 1,
    minHeight: 250,
    maxHeight: 390,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  carouselWheel: { flex: 1, minHeight: 250, position: 'relative', overflow: 'visible' },
  carouselCardPosition: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginTop: -132,
  },
  carouselCardFace: {
    backfaceVisibility: 'hidden',
  },
  carouselCardContent: {
    padding: space[3],
    borderRadius: radii['2xl'],
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },
  carouselImage: {
    height: 132,
    overflow: 'hidden',
    borderRadius: radii.xl,
    backgroundColor: soft.tint,
  },
  discountBadge: {
    position: 'absolute',
    left: space[2],
    top: space[2],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    backgroundColor: colors.accent.solid,
  },
  carouselInfo: { gap: space[1], paddingTop: space[2] },
  carouselPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    paddingTop: space[1],
  },
  noOffers: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[8],
  },
});
