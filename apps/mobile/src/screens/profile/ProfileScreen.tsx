import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  FileText,
  LogOut,
  Pencil,
  ShieldCheck,
  Store,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import {
  Button,
  Chip,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import { blockedNotice, fullName } from '@/features/auth/account';
import { deleteAccount, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import {
  useFavoriteCategories,
  useFavoriteLocations,
  useToggleFavoriteCategory,
} from '@/features/favorites/queries';
import { errorMessage } from '@/lib/api-error';
import { colors, radius, space } from '@/theme';

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text variant="title1" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="callout" color="secondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function LegalRows() {
  const router = useRouter();
  return (
    <View>
      <ListRow
        icon={ShieldCheck}
        title="Datenschutz"
        onPress={() =>
          router.push({ pathname: '/rechtliches/[seite]', params: { seite: 'datenschutz' } })
        }
      />
      <ListRow
        icon={FileText}
        title="Impressum"
        onPress={() =>
          router.push({ pathname: '/rechtliches/[seite]', params: { seite: 'impressum' } })
        }
      />
    </View>
  );
}

function FavoriteCategories() {
  const { data: selected } = useFavoriteCategories();
  const toggle = useToggleFavoriteCategory();

  return (
    <View style={styles.section}>
      <SectionHeader title="Das interessiert mich" />
      <Text variant="footnote" color="secondary">
        Wähl aus, was dir Spaß macht.
      </Text>
      <View style={styles.chips}>
        {OFFER_CATEGORIES.map((category) => {
          const active = selected?.includes(category) ?? false;
          return (
            <Chip
              key={category}
              label={OFFER_CATEGORY_LABELS[category]}
              selected={active}
              onPress={() => toggle.mutate({ item: category, favorite: !active })}
            />
          );
        })}
      </View>
      {toggle.error ? (
        <Text variant="footnote" style={{ color: colors.status.error.text }}>
          {errorMessage(toggle.error)}
        </Text>
      ) : null}
    </View>
  );
}

function FavoriteLocations() {
  const router = useRouter();
  const { locations, isPending, error } = useFavoriteLocations();

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Lieblingsorte"
        detail={locations.length > 0 ? String(locations.length) : undefined}
      />
      {isPending ? (
        <Skeleton height={56} />
      ) : error ? (
        <Text variant="footnote" style={{ color: colors.status.error.text }}>
          {errorMessage(error)}
        </Text>
      ) : locations.length === 0 ? (
        <Text variant="footnote" color="secondary">
          Noch keine Lieblingsorte. Tipp bei einem Anbieter oben rechts auf das Herz.
        </Text>
      ) : (
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
      )}
    </View>
  );
}

/** Tab „Profil“: Name, Interessen, Lieblingsorte, Abmelden und Konto löschen. */
export function ProfileScreen() {
  const router = useRouter();
  const deleteSheet = useRef<SheetRef>(null);
  const { ready, userId, email, account, accountLoading, accountError, refetchAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!ready || (userId !== null && accountLoading)) {
    return (
      <Screen>
        <Header title="Profil" />
        <Skeleton height={64} />
        <Skeleton height={120} radius={radius.card} />
      </Screen>
    );
  }

  if (userId === null) {
    return (
      <Screen>
        <Header title="Profil" />
        <EmptyState
          icon={UserRound}
          title="Noch nicht angemeldet"
          message="Mit einem Konto holst du dir Codes, merkst dir Lieblingsorte und findest alles wieder."
        />
        <Button label="Anmelden" size="lg" fullWidth onPress={() => router.push('/anmelden')} />
        <LegalRows />
      </Screen>
    );
  }

  if (!account) {
    return (
      <Screen>
        <Header title="Profil" />
        <EmptyState
          tone="error"
          icon={TriangleAlert}
          title="Konto nicht geladen"
          message={errorMessage(accountError)}
          actionLabel="Nochmal versuchen"
          onAction={() => void refetchAccount()}
        />
        <ListRow icon={LogOut} title="Abmelden" onPress={() => void signOut()} />
      </Screen>
    );
  }

  const blocked = blockedNotice(account);
  const name = fullName(account);

  const confirmDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      deleteSheet.current?.dismiss();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <Header title={name || 'Dein Profil'} subtitle={email ?? undefined} />

      {blocked ? (
        <View style={styles.notice} accessibilityRole="alert">
          <TriangleAlert size={20} color={colors.status.warning.onSubtle} />
          <Text variant="footnote" style={styles.noticeText}>
            {blocked}
          </Text>
        </View>
      ) : null}

      {!account.profileComplete ? (
        <Button
          label="Namen ergänzen"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/name')}
        />
      ) : null}

      <FavoriteCategories />
      <FavoriteLocations />

      <View style={styles.section}>
        <SectionHeader title="Konto" />
        <View>
          <ListRow
            icon={Pencil}
            title="Name ändern"
            detail={name || undefined}
            onPress={() => router.push('/name')}
          />
          <ListRow icon={LogOut} title="Abmelden" onPress={() => void signOut()} />
          <ListRow
            icon={Trash2}
            title="Konto löschen"
            destructive
            onPress={() => {
              setDeleteError(null);
              deleteSheet.current?.present();
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Rechtliches" />
        <LegalRows />
      </View>

      <Sheet ref={deleteSheet} title="Konto wirklich löschen?">
        <Text variant="body" color="secondary">
          Dein Konto, dein Name und deine Favoriten werden endgültig gelöscht. Aktive Codes werden
          storniert. Das lässt sich nicht rückgängig machen.
        </Text>
        {deleteError ? (
          <Text
            variant="callout"
            accessibilityLiveRegion="polite"
            style={{ color: colors.status.error.text }}
          >
            {deleteError}
          </Text>
        ) : null}
        <Button
          label="Konto endgültig löschen"
          variant="danger"
          size="lg"
          fullWidth
          loading={deleting}
          onPress={() => void confirmDelete()}
        />
        <Button
          label="Abbrechen"
          variant="secondary"
          fullWidth
          disabled={deleting}
          onPress={() => deleteSheet.current?.dismiss()}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[1] },
  section: { gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  notice: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.status.warning.subtle,
  },
  noticeText: { flex: 1, color: colors.status.warning.onSubtle },
});
