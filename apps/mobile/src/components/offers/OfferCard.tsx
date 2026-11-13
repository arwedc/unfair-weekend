import { formatPrice, seatsLabel } from '@repo/shared';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { OfferFavoriteButton } from '@/components/favorites/OfferFavoriteButton';
import { Badge, PressableScale, Skeleton, Text } from '@/components/ui';
import { offerBadges, offerWhenText } from '@/features/offers/feed-logic';
import type { Offer } from '@/features/offers/types';
import { useT } from '@/lib/i18n/context';
import { badge, colors, radius, space } from '@/theme';

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

/** Angebotskarte: großes Foto mit Deal-Badges, darunter Titel, Ort, Zeit und Preis. */
export function OfferCard({ offer, variant = 'large', onOpen, priority, style }: OfferCardProps) {
  const router = useRouter();
  const { t, locale } = useT();
  const badges = offerBadges(offer, undefined, locale);
  const when = offerWhenText(offer, undefined, locale);
  const soldOut = offer.free_seats === 0;
  const compact = variant === 'compact';

  const label = [
    offer.title,
    offer.location_name,
    when,
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
        <OfferImage
          path={offer.cover_image_path}
          priority={priority}
          style={[styles.image, soldOut && styles.imageSoldOut]}
        />
        <View style={styles.badges}>
          {badges.map((item) => (
            <Badge
              key={item.label}
              label={item.label}
              variant={item.variant}
              size={!compact && item.variant === 'deal' ? 'large' : 'default'}
              onImage
            />
          ))}
        </View>
        <OfferFavoriteButton offerId={offer.id} title={offer.title} style={styles.heart} />
      </View>

      <View style={styles.body}>
        <Text variant={compact ? 'bodyStrong' : 'title3'} numberOfLines={2}>
          {offer.title}
        </Text>
        <View style={styles.metaRow}>
          <MapPin size={14} color={colors.text.tertiary} />
          <Text variant="footnote" color="secondary" numberOfLines={1} style={styles.metaText}>
            {offer.location_name}
          </Text>
        </View>
        <Text variant="footnote" color="secondary" numberOfLines={1}>
          {when}
        </Text>
        <View style={styles.priceRow}>
          <PriceRow
            originalPriceCents={offer.original_price_cents}
            dealPriceCents={offer.deal_price_cents}
          />
          {!compact ? (
            <Text variant="footnote" color={soldOut ? 'tertiary' : 'secondary'}>
              {seatsLabel(offer.free_seats, locale)}
            </Text>
          ) : null}
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
        <Skeleton width="50%" height={14} />
        <Skeleton width="35%" height={22} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  // Ausgebuchte Angebote treten optisch zurück, bleiben aber sichtbar.
  imageSoldOut: { opacity: 0.55 },
  skeletonImage: { aspectRatio: 4 / 3 },
  badges: {
    position: 'absolute',
    top: badge.inset,
    left: badge.inset,
    // Platz für das Herz rechts oben
    right: badge.inset + space[10],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1.5],
  },
  heart: { position: 'absolute', top: badge.inset, right: badge.inset },
  body: { paddingTop: space[3], gap: space[1] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  metaText: { flexShrink: 1 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space[1],
  },
});
