import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Bell,
  CircleHelp,
  FileText,
  LogOut,
  Pencil,
  ShieldCheck,
  Store,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, View } from 'react-native';

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
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import {
  useFavoriteCategories,
  useFavoriteLocations,
  useToggleFavoriteCategory,
} from '@/features/favorites/queries';
import { usePushStatus, useSetPushEnabled } from '@/features/push/use-push';
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

function OnboardingHelpRow() {
  const { replay } = useOnboarding();
  return (
    <ListRow
      icon={CircleHelp}
      title="App kurz erklärt"
      detail="Den Rundgang jederzeit wiederholen"
      onPress={replay}
    />
  );
}

/** Schalter für Push-Benachrichtigungen. Erklärt, warum es (noch) nicht geht, statt still nichts zu tun. */
function PushSettings() {
  const { data: state, refetch } = usePushStatus();
  const toggle = useSetPushEnabled();

  useEffect(() => {
    // Nach der Rückkehr aus den Handy-Einstellungen den Stand neu lesen.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  return (
    <View style={styles.section}>
      <SectionHeader title="Benachrichtigungen" />
      {!state ? (
        <Skeleton height={56} />
      ) : (
        <ListRow
          icon={Bell}
          title="Push-Nachrichten"
          detail={state.detail}
          onPress={
            state.action === 'settings'
              ? () => void Linking.openSettings()
              : state.action === 'toggle' && !toggle.isPending
                ? () => toggle.mutate(!state.enabled)
                : undefined
          }
          trailing={
            state.action === 'toggle' ? (
              <Switch
                value={state.enabled}
                disabled={toggle.isPending}
                onValueChange={(value) => toggle.mutate(value)}
                trackColor={{ true: colors.accent.solid, false: colors.border.strong }}
                accessibilityLabel="Push-Nachrichten"
              />
            ) : undefined
          }
        />
      )}
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

/** Einstieg zu den gemerkten Standorten. */
function Favorites() {
  const router = useRouter();
  const { locations } = useFavoriteLocations();

  return (
    <View style={styles.section}>
      <SectionHeader title="Favoriten" />
      <ListRow
        icon={Store}
        title="Lieblingsorte"
        detail={
          locations.length > 0
            ? `${locations.length} ${locations.length === 1 ? 'Ort' : 'Orte'}`
            : 'Tipp bei Anbietern auf das Herz'
        }
        onPress={() => router.push('/favoriten')}
      />
    </View>
  );
}

/** Tab „Profil“: Name, Interessen, Favoriten, Push, Abmelden und Konto löschen. */
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
        <OnboardingHelpRow />
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
        <OnboardingHelpRow />
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
      <OnboardingHelpRow />

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
      <Favorites />
      <PushSettings />

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
