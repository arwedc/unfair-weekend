import { OFFER_CATEGORIES } from '@repo/shared';
import { LOCALE_NAMES, LOCALES } from '@repo/shared/i18n';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Bell,
  CircleHelp,
  FileText,
  Languages,
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
  SegmentedTabs,
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
import { useT } from '@/lib/i18n/context';
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
  const { t } = useT();
  return (
    <View>
      <ListRow
        icon={ShieldCheck}
        title={t.common.profile.privacy}
        onPress={() =>
          router.push({ pathname: '/rechtliches/[seite]', params: { seite: 'datenschutz' } })
        }
      />
      <ListRow
        icon={FileText}
        title={t.common.profile.imprint}
        onPress={() =>
          router.push({ pathname: '/rechtliches/[seite]', params: { seite: 'impressum' } })
        }
      />
    </View>
  );
}

function OnboardingHelpRow() {
  const { replay } = useOnboarding();
  const { t } = useT();
  return (
    <ListRow
      icon={CircleHelp}
      title={t.common.profile.tour}
      detail={t.common.profile.tourHint}
      onPress={replay}
    />
  );
}

/** Schalter für Push-Benachrichtigungen. Erklärt, warum es (noch) nicht geht, statt still nichts zu tun. */
function PushSettings() {
  const { data: state, refetch } = usePushStatus();
  const toggle = useSetPushEnabled();
  const { t } = useT();

  useEffect(() => {
    // Nach der Rückkehr aus den Handy-Einstellungen den Stand neu lesen.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  return (
    <View style={styles.section}>
      <SectionHeader title={t.common.profile.notifications} />
      {!state ? (
        <Skeleton height={56} />
      ) : (
        <ListRow
          icon={Bell}
          title={t.common.profile.push}
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
                accessibilityLabel={t.common.profile.push}
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
  const { t, labels } = useT();

  return (
    <View style={styles.section}>
      <SectionHeader title={t.common.profile.interests} />
      <Text variant="footnote" color="secondary">
        {t.common.profile.interestsHint}
      </Text>
      <View style={styles.chips}>
        {OFFER_CATEGORIES.map((category) => {
          const active = selected?.includes(category) ?? false;
          return (
            <Chip
              key={category}
              label={labels.offerCategory[category]}
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
  const { t } = useT();
  const p = t.common.profile;

  return (
    <View style={styles.section}>
      <SectionHeader title={p.favorites} />
      <ListRow
        icon={Store}
        title={p.favoritePlaces}
        detail={locations.length > 0 ? p.placesCount(locations.length) : p.placesHint}
        onPress={() => router.push('/favoriten')}
      />
    </View>
  );
}

/** Sprache der Oberfläche. Inhalte (Angebote, Bewertungen) bleiben, wie sie sind. */
function LanguageSettings() {
  const { t, locale, setLocale } = useT();
  return (
    <View style={styles.section}>
      <SectionHeader title={t.common.profile.language} />
      <View style={styles.language}>
        <Languages size={20} color={colors.text.secondary} />
        <View style={styles.languageTabs}>
          <SegmentedTabs
            tabs={LOCALES.map((key) => ({ key, label: LOCALE_NAMES[key] }))}
            value={locale}
            onChange={setLocale}
          />
        </View>
      </View>
      <Text variant="footnote" color="secondary">
        {t.common.profile.languageHint}
      </Text>
    </View>
  );
}

/** Tab „Profil“: Name, Interessen, Favoriten, Push, Sprache, Abmelden und Konto löschen. */
export function ProfileScreen() {
  const router = useRouter();
  const deleteSheet = useRef<SheetRef>(null);
  const { ready, userId, email, account, accountLoading, accountError, refetchAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { t, locale } = useT();
  const p = t.common.profile;

  if (!ready || (userId !== null && accountLoading)) {
    return (
      <Screen>
        <Header title={p.title} />
        <Skeleton height={64} />
        <Skeleton height={120} radius={radius.card} />
      </Screen>
    );
  }

  if (userId === null) {
    return (
      <Screen>
        <Header title={p.title} />
        <OnboardingHelpRow />
        <EmptyState icon={UserRound} title={p.notSignedIn} message={p.notSignedInText} />
        <Button
          label={t.common.signIn}
          size="lg"
          fullWidth
          onPress={() => router.push('/anmelden')}
        />
        <LanguageSettings />
        <LegalRows />
      </Screen>
    );
  }

  if (!account) {
    return (
      <Screen>
        <Header title={p.title} />
        <OnboardingHelpRow />
        <EmptyState
          tone="error"
          icon={TriangleAlert}
          title={t.common.accountNotLoaded}
          message={errorMessage(accountError)}
          actionLabel={t.common.retry}
          onAction={() => void refetchAccount()}
        />
        <ListRow icon={LogOut} title={t.common.signOut} onPress={() => void signOut()} />
      </Screen>
    );
  }

  const blocked = blockedNotice(account, locale);
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
      <Header title={name || p.yourProfile} subtitle={email ?? undefined} />
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
          label={p.addName}
          variant="secondary"
          fullWidth
          onPress={() => router.push('/name')}
        />
      ) : null}

      <FavoriteCategories />
      <Favorites />
      <PushSettings />
      <LanguageSettings />

      <View style={styles.section}>
        <SectionHeader title={p.account} />
        <View>
          <ListRow
            icon={Pencil}
            title={p.changeName}
            detail={name || undefined}
            onPress={() => router.push('/name')}
          />
          <ListRow icon={LogOut} title={t.common.signOut} onPress={() => void signOut()} />
          <ListRow
            icon={Trash2}
            title={p.deleteAccount}
            destructive
            onPress={() => {
              setDeleteError(null);
              deleteSheet.current?.present();
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={p.legal} />
        <LegalRows />
      </View>

      <Sheet ref={deleteSheet} title={p.deleteTitle}>
        <Text variant="body" color="secondary">
          {p.deleteText}
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
          label={p.deleteConfirm}
          variant="danger"
          size="lg"
          fullWidth
          loading={deleting}
          onPress={() => void confirmDelete()}
        />
        <Button
          label={t.common.cancel}
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
  language: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  languageTabs: { flex: 1 },
});
