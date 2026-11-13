import { Stack, useRouter } from 'expo-router';
import { Store } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { Button, EmptyState, ListRow, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useFavoriteLocations } from '@/features/favorites/queries';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, layout, space } from '@/theme';

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

/** „Favoriten“ aus dem Profil: gemerkte Standorte. */
export function FavoritesScreen() {
  const router = useRouter();
  const { t } = useT();
  const { userId } = useAuth();

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
            icon={Store}
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
        <LocationFavorites />
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
});
