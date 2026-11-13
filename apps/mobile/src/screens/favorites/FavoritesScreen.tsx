import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, Store } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { OfferCard, OfferCardSkeleton } from '@/components/offers/OfferCard';
import {
  Appear,
  Button,
  EmptyState,
  ListRow,
  SegmentedTabs,
  Skeleton,
  Text,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useFavoriteLocations, useFavoriteOffers } from '@/features/favorites/queries';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, layout, space } from '@/theme';

type Tab = 'angebote' | 'orte';

function isTab(value: unknown): value is Tab {
  return value === 'angebote' || value === 'orte';
}

function OfferFavorites() {
  const router = useRouter();
  const { t } = useT();
  const { offers, isPending } = useFavoriteOffers();

  if (isPending) return <OfferCardSkeleton />;
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title={t.parts.favorites.noOffersTitle}
        message={t.parts.favorites.noOffersText}
        actionLabel={t.parts.favorites.discover}
        onAction={() => router.navigate('/')}
      />
    );
  }
  return (
    <View style={styles.list}>
      {offers.map((offer, index) => (
        <Appear key={offer.id} index={index}>
          <OfferCard offer={offer} priority={index < 2 ? 'high' : 'normal'} />
        </Appear>
      ))}
    </View>
  );
}

function LocationFavorites() {
  const router = useRouter();
  const { t } = useT();
  const { locations, isPending, error } = useFavoriteLocations();

  if (isPending) return <Skeleton height={64} />;
  if (error) {
    return (
      <Text variant="footnote" style={{ color: colors.status.error.text }}>
        {errorMessage(error)}
      </Text>
    );
  }
  if (locations.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title={t.parts.favorites.noPlacesTitle}
        message={t.parts.favorites.noPlacesText}
      />
    );
  }
  return (
    <View>
      {locations.map((place) => (
        <ListRow
          key={place.id}
          icon={Store}
          title={place.company_name}
          detail={[place.street, place.city].filter(Boolean).join(', ')}
          onPress={() => router.push({ pathname: '/standort/[id]', params: { id: place.id } })}
          trailing={<FavoriteButton locationId={place.id} name={place.company_name} />}
        />
      ))}
    </View>
  );
}

/** „Favoriten“ aus dem Profil: gemerkte Angebote und Lieblingsorte, umschaltbar. */
export function FavoritesScreen() {
  const router = useRouter();
  const { t } = useT();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : 'angebote');
  const { userId } = useAuth();
  const { offers } = useFavoriteOffers();
  const { locations } = useFavoriteLocations();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: t.common.screens.favorites }} />

      {userId === null ? (
        <>
          <EmptyState
            icon={Heart}
            title={t.parts.favorites.signInTitle}
            message={t.parts.favorites.signInText}
          />
          <Button
            label={t.common.signIn}
            size="lg"
            fullWidth
            onPress={() => router.push('/anmelden')}
          />
        </>
      ) : (
        <>
          <SegmentedTabs
            tabs={[
              { key: 'angebote', label: t.parts.favorites.offers, count: offers.length },
              { key: 'orte', label: t.parts.favorites.places, count: locations.length },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'angebote' ? <OfferFavorites /> : <LocationFavorites />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[4],
    paddingBottom: space[12],
    gap: space[6],
  },
  list: { gap: space[8] },
});
