import { STORAGE_BUCKETS } from '@repo/shared';
import { Stack, useRouter } from 'expo-router';
import { CloudOff, Globe, MapPin, Phone, SearchX, Sparkles } from 'lucide-react-native';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { OfferCard, OfferCardSkeleton } from '@/components/offers/OfferCard';
import { OfferImage } from '@/components/offers/OfferImage';
import { Button, EmptyState, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useLocation, useLocationOffers } from '@/features/offers/queries';
import { errorMessage, isOffline } from '@/lib/api-error';
import { callPhone, openInMaps, openWebsite } from '@/lib/open-external';
import { colors, layout, radius, space } from '@/theme';

/** Standortseite: wer der Anbieter ist, wie man ihn erreicht und was er gerade anbietet. */
export function LocationScreen({ locationId }: { locationId: string }) {
  const router = useRouter();
  const location = useLocation(locationId);
  const offers = useLocationOffers(locationId);

  const refreshing = location.isRefetching || offers.isRefetching;
  const refresh = () => {
    void location.refetch();
    void offers.refetch();
  };

  if (location.isPending) {
    return (
      <View style={styles.screen} accessible accessibilityLabel="Standort wird geladen">
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.content}>
          <Skeleton width={72} height={72} radius={radius.card} />
          <Skeleton width="70%" height={30} />
          <Skeleton height={64} />
          <OfferCardSkeleton />
        </View>
      </View>
    );
  }

  if (location.error) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState
          tone="error"
          icon={CloudOff}
          title={isOffline(location.error) ? 'Kein Netz' : 'Das hat nicht geklappt'}
          message={errorMessage(location.error)}
          actionLabel="Nochmal versuchen"
          onAction={refresh}
        />
      </View>
    );
  }

  const place = location.data;
  if (!place) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState
          icon={SearchX}
          title="Standort nicht gefunden"
          message="Diesen Standort gibt es nicht mehr oder er ist gerade nicht sichtbar."
          actionLabel="Zu den Angeboten"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  const address = [place.street, `${place.postal_code} ${place.city}`]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  const showLocationName = place.name.trim() !== '' && place.name !== place.company_name;
  const list = offers.data ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.accent.solid}
          colors={[colors.accent.solid]}
        />
      }
    >
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => <FavoriteButton locationId={place.id} name={place.company_name} />,
        }}
      />

      <View style={styles.head}>
        {place.company_logo_path ? (
          <OfferImage
            path={place.company_logo_path}
            bucket={STORAGE_BUCKETS.companyLogos}
            contentFit="contain"
            style={styles.logo}
            accessibilityLabel={`Logo von ${place.company_name}`}
          />
        ) : null}
        <View style={styles.headText}>
          <Text variant="title1" accessibilityRole="header">
            {place.company_name}
          </Text>
          {showLocationName ? (
            <Text variant="callout" color="secondary">
              {place.name}
            </Text>
          ) : null}
        </View>
      </View>

      {place.company_description?.trim() ? (
        <Text variant="body" color="secondary">
          {place.company_description.trim()}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={address || 'Route'}
          icon={MapPin}
          variant="secondary"
          accessibilityHint="Öffnet die Adresse in der Karten-App"
          onPress={() =>
            void openInMaps({
              label: place.company_name,
              address,
              lat: place.lat,
              lng: place.lng,
            })
          }
        />
        <View style={styles.actionRow}>
          {place.phone?.trim() ? (
            <Button
              label="Anrufen"
              icon={Phone}
              variant="outline"
              style={styles.actionHalf}
              onPress={() => void callPhone(place.phone)}
            />
          ) : null}
          {place.website?.trim() ? (
            <Button
              label="Webseite"
              icon={Globe}
              variant="outline"
              style={styles.actionHalf}
              onPress={() => void openWebsite(place.website)}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.offers}>
        <SectionHeader
          title="Aktuelle Angebote"
          detail={list.length > 0 ? String(list.length) : undefined}
        />
        {offers.isPending ? (
          <OfferCardSkeleton />
        ) : offers.error ? (
          <EmptyState
            tone="error"
            icon={CloudOff}
            title="Angebote nicht geladen"
            message={errorMessage(offers.error)}
            actionLabel="Nochmal versuchen"
            onAction={refresh}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Gerade nichts im Angebot"
            message="Hier gibt es im Moment kein Angebot. Schau bald wieder vorbei."
          />
        ) : (
          list.map((offer) => <OfferCard key={offer.id} offer={offer} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[4],
    paddingBottom: space[12],
    gap: space[5],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  headText: { flex: 1, gap: space[1] },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.default,
  },
  actions: { gap: space[2] },
  actionRow: { flexDirection: 'row', gap: space[2] },
  actionHalf: { flex: 1 },
  offers: { gap: space[6], marginTop: space[2] },
});
