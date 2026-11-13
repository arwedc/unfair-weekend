import { formatPrice, isFewSeatsLeft, seatsLabel } from '@repo/shared';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { DiscountTag } from '@/components/offers/DiscountTag';
import { OfferImage } from '@/components/offers/OfferImage';
import { PriceRow } from '@/components/offers/PriceRow';
import { PressableScale, Text } from '@/components/ui';
import { offerWhenText } from '@/features/offers/feed-logic';
import type { Offer } from '@/features/offers/types';
import { useT } from '@/lib/i18n/context';
import { colors, radius, shadow, space } from '@/theme';

export const MAP_TILE_HEIGHT = 128;

export interface MapOfferTileProps {
  offer: Offer;
  width: number;
  /** z. B. „2 von 7“ für Screenreader. */
  position: string;
}

/** Kleine Angebotskachel über der Karte: Foto links, das Wichtigste rechts. Tippen öffnet das Angebot. */
export function MapOfferTile({ offer, width, position }: MapOfferTileProps) {
  const router = useRouter();
  const { t, locale } = useT();
  const when = offerWhenText(offer, undefined, locale);
  const fewSeats = isFewSeatsLeft(offer.free_seats);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        offer.title,
        offer.location_name,
        when,
        t.parts.card.priceAria(
          formatPrice(offer.deal_price_cents, { locale }),
          formatPrice(offer.original_price_cents, { locale }),
        ),
        t.parts.card.cheaper(offer.discount_percent),
        seatsLabel(offer.free_seats, locale),
        position,
      ].join(', ')}
      accessibilityHint={t.parts.card.openSwipeHint}
      pressedScale={0.98}
      onPress={() => router.push({ pathname: '/angebot/[id]', params: { id: offer.id } })}
      style={[styles.tile, { width }]}
    >
      <OfferImage path={offer.cover_image_path} priority="high" style={styles.image} />

      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {offer.title}
        </Text>
        <View style={styles.metaRow}>
          <MapPin size={13} color={colors.text.tertiary} />
          <Text variant="caption" color="secondary" numberOfLines={1} style={styles.shrink}>
            {offer.location_name}
          </Text>
        </View>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {when}
          {fewSeats ? (
            <Text variant="caption" color="accent">
              {` · ${seatsLabel(offer.free_seats, locale)}`}
            </Text>
          ) : null}
        </Text>
        <View style={styles.bottomRow}>
          <PriceRow
            originalPriceCents={offer.original_price_cents}
            dealPriceCents={offer.deal_price_cents}
          />
          <DiscountTag percent={offer.discount_percent} />
        </View>
      </View>
    </PressableScale>
  );
}

const IMAGE_SIZE = MAP_TILE_HEIGHT - space[2] * 2;

const styles = StyleSheet.create({
  tile: {
    height: MAP_TILE_HEIGHT,
    flexDirection: 'row',
    gap: space[3],
    padding: space[2],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: radius.image,
    borderCurve: 'continuous',
  },
  body: { flex: 1, justifyContent: 'center', gap: space[0.5], paddingRight: space[1] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  shrink: { flexShrink: 1 },
  // Preis und Rabatt direkt nebeneinander, mittig auf einer Linie.
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[1],
  },
});
