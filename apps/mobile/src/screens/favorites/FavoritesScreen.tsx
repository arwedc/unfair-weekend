import { formatPrice, STORAGE_BUCKETS } from '@repo/shared';
import { useRouter } from 'expo-router';
import { CloudOff, Heart } from 'lucide-react-native';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { OfferImage } from '@/components/offers/OfferImage';
import { Stars } from '@/components/reviews/Stars';
import {
  Appear,
  Button,
  EmptyState,
  PressableScale,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import type { FavoriteLocation } from '@/features/favorites/api';
import {
  favoriteCoverPath,
  sortFavorites,
  summarizeFavoriteOffers,
  type FavoriteOfferSummary,
} from '@/features/favorites/favorite-logic';
import { useFavoriteLocations } from '@/features/favorites/queries';
import { offerWhenText } from '@/features/offers/feed-logic';
import { useOffers } from '@/features/offers/queries';
import type { Offer } from '@/features/offers/types';
import { initials } from '@/features/profile/profile-logic';
import { useLocationRatings } from '@/features/reviews/queries';
import { formatRating, reviewCountLabel } from '@/features/reviews/review-logic';
import { errorMessage, isOffline } from '@/lib/api-error';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { colors, fonts, layout, radii, radius, shadow, soft, space } from '@/theme';

const COVER_HEIGHT = 168;
const LOGO_SIZE = 56;

function Header() {
  const { t } = useT();
  const f = t.parts.favorites;
  return (
    <View style={styles.header}>
      <Text variant="overline" color="accent">
        {f.overline}
      </Text>
      <Text variant="title1" accessibilityRole="header">
        {f.title}
      </Text>
    </View>
  );
}

/** Große Karte eines Lieblingsorts: Foto, Logo, Bewertung und das nächste freie Angebot. */
function FavoriteCard({
  place,
  summary,
  rating,
}: {
  place: FavoriteLocation;
  summary: FavoriteOfferSummary<Offer> | undefined;
  rating: { average: number; count: number } | undefined;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const f = t.parts.favorites;
  const count = summary?.count ?? 0;
  const next = summary?.next ?? null;
  const cover = favoriteCoverPath(place.image_paths, next);
  const placeLine = [place.name !== place.company_name ? place.name : '', place.city]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');
  const countLabel = count > 0 ? f.offers(count) : f.noOffers;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={f.open(
        place.company_name,
        next ? `${countLabel}. ${f.next}: ${next.title}` : countLabel,
      )}
      onPress={() => router.push({ pathname: '/standort/[id]', params: { id: place.id } })}
      pressedScale={0.98}
      style={styles.card}
    >
      <View style={styles.cover}>
        <OfferImage path={cover} style={StyleSheet.absoluteFill} />
        <View style={[styles.countPill, count > 0 ? styles.countPillOn : styles.countPillOff]}>
          <Text
            variant="caption"
            style={[
              styles.semibold,
              { color: count > 0 ? colors.accent.onSolid : colors.text.secondary },
            ]}
          >
            {countLabel}
          </Text>
        </View>
        <View style={styles.heart}>
          <FavoriteButton locationId={place.id} name={place.company_name} />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.logo}>
            {place.company_logo_path ? (
              <OfferImage
                path={place.company_logo_path}
                bucket={STORAGE_BUCKETS.companyLogos}
                contentFit="cover"
                style={styles.logoImage}
              />
            ) : (
              <Text variant="title3" style={{ color: colors.accent.onSolid }}>
                {initials(place.company_name, '')}
              </Text>
            )}
          </View>
          <View style={styles.titleText}>
            <Text variant="headline" numberOfLines={1}>
              {place.company_name}
            </Text>
            {placeLine ? (
              <Text variant="footnote" color="secondary" numberOfLines={1}>
                {placeLine}
              </Text>
            ) : null}
          </View>
        </View>

        {rating ? (
          <View style={styles.ratingLine}>
            <Stars value={rating.average} size={14} />
            <Text variant="footnote" style={styles.semibold}>
              {formatRating(rating.average, locale)}
            </Text>
            <Text variant="footnote" color="secondary">
              · {reviewCountLabel(rating.count, locale)}
            </Text>
          </View>
        ) : null}

        {next ? (
          <View style={styles.next}>
            <Text variant="caption" color="accent" style={styles.semibold}>
              {f.next}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1}>
              {next.title}
            </Text>
            <View style={styles.nextLine}>
              <Text variant="footnote" color="secondary" numberOfLines={1} style={styles.flex}>
                {offerWhenText(next, undefined, locale)}
              </Text>
              <Text variant="subhead" color="accent" style={styles.semibold}>
                {formatPrice(next.deal_price_cents, { locale })}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** Tab „Favoriten“: gemerkte Standorte als große Karten, Orte mit freien Angeboten zuerst. */
export function FavoritesScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const f = t.parts.favorites;
  const { ready, userId } = useAuth();
  const { locations, isPending, error, refetch } = useFavoriteLocations();
  const offers = useOffers();
  const ratings = useLocationRatings(locations.map((place) => place.id));

  if (!ready || (userId !== null && isPending)) {
    return (
      <Screen>
        <Header />
        <View style={styles.list} accessible accessibilityLabel={f.loading}>
          <Skeleton height={COVER_HEIGHT + 120} radius={radius.card} />
          <Skeleton height={COVER_HEIGHT + 120} radius={radius.card} />
        </View>
      </Screen>
    );
  }

  if (userId === null) {
    return (
      <Screen>
        <Header />
        <EmptyState icon={Heart} title={f.signInTitle} message={f.signInText} />
        <Button
          label={t.common.signIn}
          size="lg"
          fullWidth
          onPress={() => router.push('/anmelden')}
        />
      </Screen>
    );
  }

  const summary = summarizeFavoriteOffers(
    offers.data ?? [],
    locations.map((place) => place.id),
  );
  const sorted = sortFavorites(locations, summary, locale);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            haptics.selection();
            void refetch();
            void offers.refetch();
          }}
          tintColor={colors.accent.strong}
          colors={[colors.accent.strong]}
        />
      }
    >
      <Header />

      {error ? (
        <EmptyState
          tone="error"
          icon={CloudOff}
          title={isOffline(error) ? t.common.noNetwork : t.common.failed}
          message={errorMessage(error)}
          actionLabel={t.common.retry}
          onAction={() => void refetch()}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={f.noPlacesTitle}
          message={f.noPlacesText}
          actionLabel={f.discover}
          onAction={() => router.navigate('/')}
        />
      ) : (
        <View style={styles.list}>
          {sorted.map((place, index) => (
            <Animated.View key={place.id} layout={LinearTransition} exiting={FadeOut}>
              <Appear index={index}>
                <FavoriteCard
                  place={place}
                  summary={summary.get(place.id)}
                  rating={ratings.data?.get(place.id)}
                />
              </Appear>
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  semibold: { fontFamily: fonts.semibold },
  header: { gap: space[1] },
  list: { gap: space[5] },

  card: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  cover: { height: COVER_HEIGHT, backgroundColor: colors.background.muted },
  countPill: {
    position: 'absolute',
    left: space[3],
    top: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.full,
  },
  countPillOn: { backgroundColor: colors.accent.solid },
  countPillOff: { backgroundColor: colors.surface.raised },
  heart: {
    position: 'absolute',
    right: space[2],
    top: space[2],
    borderRadius: radii.full,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },

  body: {
    paddingHorizontal: layout.cardPadding + space[1],
    paddingBottom: space[4],
    gap: space[3],
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3] },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginTop: -LOGO_SIZE / 2,
    borderRadius: radii.full,
    borderWidth: 3,
    borderColor: colors.surface.raised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.solid,
  },
  logoImage: { width: '100%', height: '100%' },
  titleText: { flex: 1, gap: space[0.5], paddingTop: space[2] },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  next: {
    gap: space[0.5],
    padding: space[3],
    borderRadius: radius.image,
    backgroundColor: soft.warm,
  },
  nextLine: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
});
