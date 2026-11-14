import { formatDiscount, formatPrice, seatsLabel } from '@repo/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_EMOJIS } from '@/components/feed/category-emojis';
import { PressableScale, Skeleton, Text } from '@/components/ui';
import { offerWhenText } from '@/features/offers/feed-logic';
import type { Offer } from '@/features/offers/types';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, fun, gold, radii, radius, space } from '@/theme';

import { OfferImage } from './OfferImage';

const THUMB = 104;

export interface OfferListRowProps {
  offer: Offer;
  /** Hervorgehoben, z. B. weil die Nadel dazu auf der Karte angetippt wurde. */
  highlighted?: boolean;
}

/**
 * Angebot als Zeile für Listen (Abschnitts-Seite): quadratisches Foto links, rechts Titel,
 * Ort, Zeit und Preis mit Rabatt. Kompakter als die Karte, damit viele auf einen Blick passen.
 */
export function OfferListRow({ offer, highlighted = false }: OfferListRowProps) {
  const router = useRouter();
  const { t, labels, locale } = useT();
  const when = offerWhenText(offer, undefined, locale);
  const category = CATEGORY_EMOJIS[offer.category];
  const deal = formatPrice(offer.deal_price_cents, { omitZeroCents: true, locale });
  const original = formatPrice(offer.original_price_cents, { omitZeroCents: true, locale });

  const label = [
    offer.title,
    labels.offerCategory[offer.category],
    offer.location_name,
    when,
    t.parts.card.priceAria(deal, original),
    seatsLabel(offer.free_seats, locale),
  ].join(', ');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t.parts.card.openHint}
      pressedScale={0.98}
      onPress={() => router.push({ pathname: '/angebot/[id]', params: { id: offer.id } })}
      style={[styles.row, highlighted && styles.rowHighlighted]}
    >
      {offer.cover_image_path ? (
        <OfferImage path={offer.cover_image_path} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.noPhoto, { backgroundColor: fun[category.tint].bg }]}>
          <Text style={styles.noPhotoEmoji}>{category.emoji}</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {offer.title}
        </Text>
        <Text variant="footnote" color="secondary" numberOfLines={1}>
          {offer.location_name}
        </Text>
        <Text variant="footnote" color="secondary" numberOfLines={1}>
          {when}
        </Text>
        <View style={styles.priceRow}>
          <Text variant="headline">{deal}</Text>
          <Text variant="footnote" color="tertiary" style={styles.strike}>
            {original}
          </Text>
          <View style={styles.discount}>
            <Text variant="caption" style={styles.discountText}>
              {formatDiscount(offer.discount_percent, locale)}
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function OfferListRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={THUMB} height={THUMB} radius={radius.card} />
      <View style={styles.body}>
        <Skeleton width="85%" height={18} />
        <Skeleton width="55%" height={14} />
        <Skeleton width="40%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[2],
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  rowHighlighted: { backgroundColor: colors.accent.subtle },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  noPhotoEmoji: { fontSize: 40, lineHeight: 48 },
  body: { flex: 1, gap: space[0.5] },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[1],
  },
  strike: { textDecorationLine: 'line-through' },
  discount: {
    paddingHorizontal: space[2],
    paddingVertical: space[0.5],
    borderRadius: radii.full,
    backgroundColor: colors.background.inverse,
  },
  discountText: { fontFamily: fonts.bold, color: gold[400] },
});
