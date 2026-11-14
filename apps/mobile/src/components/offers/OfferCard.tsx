import { formatPrice, seatsLabel } from '@repo/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CATEGORY_EMOJIS } from '@/components/feed/category-emojis';
import { Badge, PressableScale, Skeleton, Text } from '@/components/ui';
import { offerBadges, offerWhenText, type OfferBadge } from '@/features/offers/feed-logic';
import type { Offer } from '@/features/offers/types';
import { useT } from '@/lib/i18n/context';
import { badge, colors, fun, radii, radius, space } from '@/theme';

import { DiscountBand } from './DiscountBand';
import { OfferImage } from './OfferImage';
import { PriceRow } from './PriceRow';

export interface OfferCardProps {
  offer: Offer;
  /** „compact“ für Karussells und die Kartenvorschau, „large“ für die Liste. */
  variant?: 'large' | 'compact';
  /** Wird nach dem Tippen zusätzlich aufgerufen, z. B. um ein Sheet zu schließen. */
  onOpen?: () => void;
  priority?: 'low' | 'normal' | 'high';
  style?: StyleProp<ViewStyle>;
}

export const COMPACT_CARD_WIDTH = 264;

/**
 * Höchstens ein Badge auf dem Foto, das stärkste Kaufsignal zuerst:
 * ausgebucht > knappe Plätze > startet bald. Den Rabatt zeigt das Preisschild unten rechts.
 */
const BADGE_PRIORITY: Record<OfferBadge['variant'], number> = {
  soldOut: 0,
  neutral: 1,
  urgent: 2,
  deal: 9,
};

/**
 * Angebotskarte, bewusst schlicht: Foto mit einem Badge, Kategorie-Emoji und Preisschild,
 * darunter Titel, Zeit, Ort und Preis. Mehr steht auf der Angebotsseite.
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
  const category = CATEGORY_EMOJIS[offer.category];
  const hasPhoto = Boolean(offer.cover_image_path);

  const label = [
    offer.title,
    labels.offerCategory[offer.category],
    when,
    offer.location_name,
    t.parts.card.priceAria(
      formatPrice(offer.deal_price_cents, { locale }),
      formatPrice(offer.original_price_cents, { locale }),
    ),
    seatsLabel(offer.free_seats, locale),
  ].join(', ');

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
      style={[compact && { width: COMPACT_CARD_WIDTH }, style]}
    >
      <View>
        {hasPhoto ? (
          <OfferImage
            path={offer.cover_image_path}
            priority={priority}
            style={[styles.image, soldOut && styles.imageSoldOut]}
          />
        ) : (
          // Kein Foto hinterlegt: Fläche in der Farbe der Kategorie mit großem Emoji.
          <View
            style={[
              styles.image,
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

        {topBadge ? (
          <View style={styles.badge}>
            <Badge label={topBadge.label} variant={topBadge.variant} onImage />
          </View>
        ) : null}

        {/* Kategorie als kleines Emoji. Ohne Foto zeigt die Fläche sie schon groß. */}
        {hasPhoto ? (
          <View style={styles.categoryDot} accessible={false}>
            <Text style={styles.categoryEmoji} maxFontSizeMultiplier={1}>
              {category.emoji}
            </Text>
          </View>
        ) : null}

        {!soldOut ? <DiscountBand percent={offer.discount_percent} compact={compact} /> : null}
      </View>

      <View style={styles.body}>
        <Text variant={compact ? 'headline' : 'title3'} numberOfLines={compact ? 1 : 2}>
          {offer.title}
        </Text>
        <View style={styles.meta}>
          <Text variant="subhead" color="secondary" numberOfLines={1}>
            {when}
          </Text>
          <Text variant="subhead" color="tertiary" numberOfLines={1}>
            {offer.location_name}
          </Text>
        </View>
        <View style={styles.price}>
          <PriceRow
            originalPriceCents={offer.original_price_cents}
            dealPriceCents={offer.deal_price_cents}
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
    <View style={compact && { width: COMPACT_CARD_WIDTH }}>
      <Skeleton height={undefined} radius={radius.card} style={styles.skeletonImage} />
      <View style={styles.body}>
        <Skeleton width="80%" height={20} />
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={22} />
      </View>
    </View>
  );
}

const CATEGORY_DOT = 30;

const styles = StyleSheet.create({
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  noPhotoEmoji: { fontSize: 64, lineHeight: 76 },
  noPhotoEmojiSmall: { fontSize: 48, lineHeight: 58 },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  // Ausgebuchte Angebote treten optisch zurück, bleiben aber sichtbar.
  imageSoldOut: { opacity: 0.55 },
  skeletonImage: { aspectRatio: 4 / 3 },
  badge: { position: 'absolute', top: badge.inset, left: badge.inset },
  categoryDot: {
    position: 'absolute',
    left: badge.inset,
    bottom: badge.inset,
    width: CATEGORY_DOT,
    height: CATEGORY_DOT,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.badge.neutral.background,
  },
  categoryEmoji: { fontSize: 16, lineHeight: 20 },
  body: { paddingTop: space[3], gap: space[1] },
  meta: { gap: space[0.5] },
  price: { marginTop: space[1.5] },
});
