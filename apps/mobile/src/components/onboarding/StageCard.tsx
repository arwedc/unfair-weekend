import { formatDiscount, formatPrice } from '@repo/shared';
import { MapPin, Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { CATEGORY_ICONS } from '@/components/offers/category-icons';
import { OfferImage } from '@/components/offers/OfferImage';
import { PressableScale, Text } from '@/components/ui';
import { offerWhenText } from '@/features/offers/feed-logic';
import type { FeedOffer } from '@/features/offers/types';
import {
  cameraAt,
  clamp01,
  leadCardPose,
  orbitCardPose,
  project,
  STICKER_OUT,
  type StageGeometry,
} from '@/features/onboarding/stage-math';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, radii, shadow, soft, space } from '@/theme';

import type { CameraValues } from './PhotoPin';

/** Die Karten sind eine Illustration: Schrift wächst mit, aber nicht unbegrenzt. */
const CARD_FONT_SCALE = 1.2;

export interface StageValues extends CameraValues {
  rotation: SharedValue<number>;
  /** Vorschau springt aus dem Pin (0 → 1). */
  pop: SharedValue<number>;
  /** Auftritt des großen Angebots: Sticker, Preis-Strich (0 → 1). */
  heroIntro: SharedValue<number>;
}

interface StageCardProps {
  offer: FeedOffer;
  /** 0 = das gewählte Angebot, das durch alle Schritte wandert. */
  index: number;
  count: number;
  geometry: StageGeometry;
  values: StageValues;
  imageHeight: number;
  onMeasure?: (height: number) => void;
  /** Nur Karte 0 im Schritt 1: Tipp auf die Vorschau öffnet das Angebot. */
  onOpen?: () => void;
}

/**
 * Angebotskarte auf der Onboarding-Bühne. Karte 0 ist erst die Vorschau am Pin, dann das
 * große Angebot und schließlich die vordere Karte im 3D-Kreis. Die anderen Karten liegen
 * bis dahin versteckt dahinter und fächern sich dann in den Kreis auf.
 *
 * Die Vorschau hängt am Fokus der Kamera, nicht direkt am Pin: Beim Wechsel des Pins gleitet
 * sie hinüber, statt zu springen.
 */
export function StageCard({
  offer,
  index,
  count,
  geometry: g,
  values,
  imageHeight,
  onMeasure,
  onOpen,
}: StageCardProps) {
  const { t, locale } = useT();
  const lead = index === 0;
  const CategoryIcon = CATEGORY_ICONS[offer.category];

  const pose = useDerivedValue(() => {
    const progress = values.progress.get();
    const rotation = values.rotation.get();
    if (!lead) return orbitCardPose(index, count, progress, rotation, g);
    const focusX = values.focusU.get() * g.width;
    const focusY = values.focusV.get() * g.height;
    const pin = project(focusX, focusY, cameraAt(progress, focusX, focusY, g));
    return leadCardPose(progress, values.pop.get(), pin.x, pin.y, rotation, count, g);
  });

  const placeStyle = useAnimatedStyle(() => {
    const p = pose.get();
    return {
      opacity: p.opacity,
      zIndex: Math.round(p.depth * 100) + 10,
      transform: [
        { translateX: p.x - g.cardWidth / 2 },
        { translateY: p.y - g.cardHeight / 2 },
        { scale: p.scale },
        { rotateZ: `${p.rotateZ}deg` },
      ],
    };
  });
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${pose.get().rotateY}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${pose.get().rotateY + 180}deg` }],
  }));
  // Hintere Karten wirken wie im Dunst, das gibt dem Kreis Tiefe.
  const fogStyle = useAnimatedStyle(() => ({
    opacity: (1 - pose.get().depth) * 0.55 * clamp01(values.progress.get() - 1),
  }));

  // Nur rund um Schritt 2 sichtbar: Ort-Sticker.
  const venueStyle = useAnimatedStyle(() => {
    const visible = 1 - clamp01(Math.abs(values.progress.get() - 1) * 3);
    return {
      opacity: visible,
      transform: [{ translateY: (1 - visible) * 14 }, { rotateZ: '-4deg' }],
    };
  });
  // Auftritt des großen Angebots: Rabatt-Sticker klebt sich drauf, alter Preis wird durchgestrichen.
  const discountStyle = useAnimatedStyle(() => {
    const intro = values.heroIntro.get();
    return {
      transform: [
        { scale: interpolate(intro, [0, 1], [0.2, 1]) },
        { rotateZ: `${interpolate(intro, [0, 1], [-50, 8])}deg` },
      ],
    };
  });
  const strikeStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(values.heroIntro.get(), [0.1, 0.55], [0, 1], Extrapolation.CLAMP) },
    ],
  }));
  const dealStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          values.heroIntro.get(),
          [0.45, 0.75, 1],
          [1, 1.22, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents={onOpen ? 'box-none' : 'none'}
      style={[styles.place, { width: g.cardWidth }, placeStyle]}
    >
      <PressableScale
        disabled={!onOpen}
        accessible={Boolean(onOpen)}
        accessibilityRole="button"
        accessibilityLabel={t.parts.onboarding.pinLabel(offer.company_name, offer.title)}
        accessibilityHint={t.parts.card.openHint}
        pressedScale={0.96}
        onPress={onOpen}
      >
        <Animated.View style={[styles.face, frontStyle]}>
          <View
            style={styles.card}
            onLayout={lead ? (event) => onMeasure?.(event.nativeEvent.layout.height) : undefined}
          >
            <View style={[styles.image, { height: imageHeight }]}>
              <View style={[StyleSheet.absoluteFill, styles.imageFallback]}>
                <CategoryIcon size={44} color={colors.accent.onSubtle} strokeWidth={1.8} />
              </View>
              {offer.cover_image_path ? (
                <OfferImage
                  path={offer.cover_image_path}
                  priority={lead ? 'high' : 'normal'}
                  style={styles.photo}
                />
              ) : null}
              <View style={styles.whenChip}>
                <Text
                  variant="caption"
                  numberOfLines={1}
                  style={styles.whenText}
                  maxFontSizeMultiplier={CARD_FONT_SCALE}
                >
                  {offerWhenText(offer, undefined, locale)}
                </Text>
              </View>
            </View>
            <View style={styles.info}>
              <Text
                variant="title3"
                numberOfLines={2}
                style={styles.title}
                maxFontSizeMultiplier={CARD_FONT_SCALE}
              >
                {offer.title}
              </Text>
              <Text
                variant="footnote"
                color="secondary"
                numberOfLines={1}
                maxFontSizeMultiplier={CARD_FONT_SCALE}
              >
                {offer.company_name}
              </Text>
              <View style={styles.priceRow}>
                <Animated.View style={[styles.dealPrice, dealStyle]}>
                  <Text
                    variant="headline"
                    style={styles.dealText}
                    maxFontSizeMultiplier={CARD_FONT_SCALE}
                  >
                    {formatPrice(offer.deal_price_cents, { locale })}
                  </Text>
                </Animated.View>
                <View>
                  <Text variant="footnote" color="tertiary" maxFontSizeMultiplier={CARD_FONT_SCALE}>
                    {formatPrice(offer.original_price_cents, { locale })}
                  </Text>
                  <Animated.View style={[styles.strike, strikeStyle]} />
                </View>
              </View>
            </View>
            <Animated.View style={[styles.fog, fogStyle]} />
          </View>

          <Animated.View style={[styles.discount, discountStyle]}>
            <Text
              variant="subhead"
              style={styles.discountText}
              maxFontSizeMultiplier={CARD_FONT_SCALE}
            >
              {formatDiscount(offer.discount_percent, locale)}
            </Text>
          </Animated.View>

          {lead ? (
            <Animated.View style={[styles.venue, venueStyle]}>
              <MapPin size={14} color={colors.accent.strong} fill={colors.accent.solid} />
              <Text
                variant="caption"
                numberOfLines={1}
                style={styles.venueText}
                maxFontSizeMultiplier={CARD_FONT_SCALE}
              >
                {offer.location_name || offer.company_name}
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.back, backStyle]}>
          <View style={styles.backMark}>
            <Sparkles size={30} color={colors.accent.onSubtle} strokeWidth={2} />
          </View>
          <Text variant="subhead" style={styles.backText} maxFontSizeMultiplier={CARD_FONT_SCALE}>
            unfair weekend
          </Text>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  place: { position: 'absolute', left: 0, top: 0 },
  face: { backfaceVisibility: 'hidden' },
  card: {
    padding: space[3],
    borderRadius: radii['2xl'],
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },
  image: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    backgroundColor: soft.tint,
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: soft.tint },
  photo: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  whenChip: {
    position: 'absolute',
    left: space[2],
    bottom: space[2],
    maxWidth: '86%',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    backgroundColor: colors.badge.neutral.background,
  },
  whenText: { color: colors.badge.neutral.foreground, fontFamily: fonts.semibold },
  info: { gap: space[1], paddingTop: space[3], paddingHorizontal: space[1] },
  title: { minHeight: 52 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingTop: space[1] },
  dealPrice: { transformOrigin: '0% 50%' },
  dealText: { color: colors.text.accent, fontFamily: fonts.extrabold },
  strike: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: '50%',
    height: 2,
    borderRadius: radii.full,
    backgroundColor: colors.text.secondary,
    transformOrigin: '0% 50%',
  },
  fog: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii['2xl'],
    backgroundColor: colors.background.default,
  },
  discount: {
    position: 'absolute',
    top: space[1],
    right: -space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    borderRadius: radii.full,
    backgroundColor: colors.badge.deal.background,
    boxShadow: shadow.badge,
  },
  discountText: { color: colors.badge.deal.foreground, fontFamily: fonts.extrabold },
  venue: {
    position: 'absolute',
    top: -STICKER_OUT,
    left: space[3],
    maxWidth: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    borderRadius: radii.full,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.badge,
  },
  venueText: { flexShrink: 1, fontFamily: fonts.bold },
  back: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radii['2xl'],
    backgroundColor: soft.tint,
    backfaceVisibility: 'hidden',
  },
  backMark: {
    width: space[16],
    height: space[16],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: soft.tintStrong,
  },
  backText: { color: colors.accent.onSubtle, fontFamily: fonts.bold },
});
