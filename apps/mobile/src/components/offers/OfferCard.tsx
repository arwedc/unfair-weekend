import { formatPrice, seatsLabel } from '@repo/shared';
import { useRouter } from 'expo-router';
import { Sparkles, Star } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CATEGORY_EMOJIS } from '@/components/feed/category-emojis';
import { OfferHeart } from '@/components/favorites/OfferHeart';
import { Badge, PressableScale, Skeleton, Text } from '@/components/ui';
import {
  formatDistance,
  formatRating,
  offerBadges,
  offerWhenText,
  type OfferBadge,
} from '@/features/offers/feed-logic';
import type { Offer } from '@/features/offers/types';
import { useT } from '@/lib/i18n/context';
import { badge, colors, fonts, fun, radii, radius, shadow, space } from '@/theme';

import { DiscountBand } from './DiscountBand';
import { useOfferMeta } from './offer-meta';
import { OfferImage } from './OfferImage';
import { PriceRow } from './PriceRow';

export interface OfferCardProps {
  offer: Offer;
  /**
   * „compact“ für Karussells, „large“ für die Liste, „hero“ für den Deal des Tages
   * (größeres Foto, goldenes Etikett oben links statt des Hinweises).
   */
  variant?: 'large' | 'compact' | 'hero';
  /** Wird nach dem Tippen zusätzlich aufgerufen, z. B. um ein Sheet zu schließen. */
  onOpen?: () => void;
  priority?: 'low' | 'normal' | 'high';
  style?: StyleProp<ViewStyle>;
}

export const COMPACT_CARD_WIDTH = 264;

/**
 * Höchstens ein Badge auf dem Foto, das stärkste Kaufsignal zuerst:
 * ausgebucht > knappe Plätze > startet bald. Den Rabatt zeigt das Etikett unten links.
 */
const BADGE_PRIORITY: Record<OfferBadge['variant'], number> = {
  soldOut: 0,
  neutral: 1,
  urgent: 2,
  deal: 9,
};

/**
 * Angebotskarte, bewusst schlicht: Foto mit Rabatt-Etikett, höchstens einem Badge und Herz,
 * darunter Titel, Zeit, Bewertung, Entfernung, Ort und Preis. Mehr steht auf der Angebotsseite.
 */
export function OfferCard({ offer, variant = 'large', onOpen, priority, style }: OfferCardProps) {
  const router = useRouter();
  const { t, labels, locale } = useT();
  const topBadge = offerBadges(offer, undefined, locale)
    .filter((item) => item.variant !== 'deal')
    .sort((a, b) => BADGE_PRIORITY[a.variant] - BADGE_PRIORITY[b.variant])[0];
  const when = offerWhenText(offer, undefined, locale);
  const soldOut = offer.free_seats === 0;
  const compact = variant === 'compact';
  const hero = variant === 'hero';
  const category = CATEGORY_EMOJIS[offer.category];
  const hasPhoto = Boolean(offer.cover_image_path);
  const { rating, distance } = useOfferMeta(offer);
  const ratingText = rating ? formatRating(rating.average, locale) : null;
  const distanceText = distance !== null ? formatDistance(distance, locale) : null;

  const label = [
    hero ? t.parts.card.dealOfDay : null,
    offer.title,
    labels.offerCategory[offer.category],
    when,
    offer.location_name,
    t.parts.card.priceAria(
      formatPrice(offer.deal_price_cents, { locale }),
      formatPrice(offer.original_price_cents, { locale }),
    ),
    rating && ratingText ? t.parts.card.ratingAria(ratingText, rating.count) : null,
    distanceText ? t.parts.card.distanceAria(distanceText) : null,
    seatsLabel(offer.free_seats, locale),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t.parts.card.openHint}
      pressedScale={0.98}
      onPress={() => {
        onOpen?.();
        router.push({ pathname: '/angebot/[id]', params: { id: offer.id } });
      }}
      style={[styles.card, compact && { width: COMPACT_CARD_WIDTH }, style]}
    >
      <View>
        {hasPhoto ? (
          <OfferImage
            path={offer.cover_image_path}
            priority={priority}
            style={[styles.image, hero && styles.imageHero, soldOut && styles.imageSoldOut]}
          />
        ) : (
          // Kein Foto hinterlegt: Fläche in der Farbe der Kategorie mit großem Emoji.
          <View
            style={[
              styles.image,
              hero && styles.imageHero,
              styles.noPhoto,
              { backgroundColor: fun[category.tint].bg },
              soldOut && styles.imageSoldOut,
            ]}
          >
            <Text
              style={compact ? styles.noPhotoEmojiSmall : styles.noPhotoEmoji}
              maxFontSizeMultiplier={1}
            >
              {category.emoji}
            </Text>
          </View>
        )}

        {hero ? (
          <View style={[styles.badge, styles.heroLabel]}>
            <Sparkles size={14} color={colors.accent.solid} strokeWidth={2.5} />
            <Text variant="caption" style={styles.heroLabelText}>
              {t.parts.card.dealOfDay}
            </Text>
          </View>
        ) : topBadge ? (
          <View style={styles.badge}>
            <Badge label={topBadge.label} variant={topBadge.variant} onImage />
          </View>
        ) : null}

        {!soldOut ? <DiscountBand percent={offer.discount_percent} compact={compact} /> : null}
        <OfferHeart locationId={offer.location_id} name={offer.location_name} />
      </View>

      <View style={styles.body}>
        <Text
          variant={hero ? 'title2' : compact ? 'headline' : 'title3'}
          numberOfLines={compact ? 1 : 2}
        >
          {offer.title}
        </Text>
        <View style={styles.meta}>
          <Text variant="subhead" color="secondary" numberOfLines={1}>
            {when}
          </Text>
          {/* Ort, dazu Bewertung und Entfernung, sobald bekannt: „★ 4,8 (31) · 1,2 km · Ort“ */}
          <View style={styles.trust} accessible={false}>
            {rating && ratingText ? (
              <>
                <Star size={13} color={colors.accent.strong} fill={colors.accent.solid} />
                <Text variant="subhead" style={styles.rating}>
                  {ratingText}
                </Text>
                <Text variant="subhead" color="tertiary">
                  ({rating.count}) ·
                </Text>
              </>
            ) : null}
            {distanceText ? (
              <Text variant="subhead" color="tertiary">
                {distanceText} ·
              </Text>
            ) : null}
            <Text variant="subhead" color="tertiary" numberOfLines={1} style={styles.place}>
              {offer.location_name}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.price}>
          <PriceRow
            originalPriceCents={offer.original_price_cents}
            dealPriceCents={offer.deal_price_cents}
            size={hero ? 'large' : 'default'}
          />
        </View>
      </View>
    </PressableScale>
  );
}

/** Platzhalter in der Form einer Karte, während die Angebote laden. */
export function OfferCardSkeleton({ variant = 'large' }: { variant?: 'large' | 'compact' }) {
  const compact = variant === 'compact';
  return (
    <View style={[styles.card, compact && { width: COMPACT_CARD_WIDTH }]}>
      <Skeleton height={undefined} radius={0} style={styles.skeletonImage} />
      <View style={styles.body}>
        <Skeleton width="80%" height={20} />
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  noPhotoEmoji: { fontSize: 64, lineHeight: 76 },
  noPhotoEmojiSmall: { fontSize: 48, lineHeight: 58 },
  // Eingeschachtelt: weiße Karte mit feinem Rand und weichem Schatten, das Foto oben bündig.
  card: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.surface.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: 16 / 10 },
  imageHero: { aspectRatio: 4 / 3 },
  // „Deal des Tages“: schwarzes Etikett mit goldenem Funkeln, oben links.
  heroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
    backgroundColor: colors.background.inverse,
    boxShadow: badge.shadow,
  },
  heroLabelText: { fontFamily: fonts.bold, color: colors.accent.solid },
  // Ausgebuchte Angebote treten optisch zurück, bleiben aber sichtbar.
  imageSoldOut: { opacity: 0.55 },
  skeletonImage: { aspectRatio: 16 / 10 },
  // Oben links der Hinweis (z. B. „Nur heute“), unten links das goldene Rabatt-Etikett.
  badge: { position: 'absolute', top: badge.inset, left: badge.inset },
  body: { padding: space[3], paddingTop: space[3], gap: space[1] },
  meta: { gap: space[0.5] },
  trust: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  rating: { fontFamily: fonts.semibold, color: colors.text.primary },
  place: { flexShrink: 1 },
  // Gestrichelte Linie trennt Infos und Preis, wie ein Abriss am Gutschein.
  divider: {
    marginTop: space[2],
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.default,
  },
  // Rabatt steht auf dem Foto, hier nur Deal-Preis und durchgestrichener alter Preis.
  price: { marginTop: space[1] },
});
